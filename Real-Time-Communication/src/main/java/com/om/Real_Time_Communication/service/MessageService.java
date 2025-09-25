package com.om.Real_Time_Communication.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.Real_Time_Communication.Repository.*;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.dto.EventMessage;
import com.om.Real_Time_Communication.dto.MessageCreated;
import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.models.*;
import com.om.Real_Time_Communication.utility.IdValidators;
import com.om.Real_Time_Communication.security.SessionRegistry;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.nio.file.AccessDeniedException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MessageService {

    @Autowired
    private  OutboxEventRepository outboxRepo;
    @Autowired
    private  ObjectMapper objectMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private BlockService blockService;

    @Autowired
    private CallRoomRepository callRoomRepository;

    @Autowired
    private EventPublisher eventPublisher;

    @Autowired
    private ChatRoomParticipantRepository chatRoomParticipantRepository;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;


    @Autowired
    private ChatRoomService aclService;

    @Autowired(required = false)
    private DirectRoomPolicy directPolicy;

    @Autowired
    private RoomMembershipService membership;

    @Autowired
    private SessionRegistry sessionRegistry;

    @Autowired
    private PendingMessageService pendingMessages;

    @Autowired
    private UndeliveredMessageStore undeliveredStore;


    @Transactional
    public ChatMessage saveInbound(Long roomId, Long senderId, ChatSendDto dto) {
        // 0) Guard rails
        if (roomId == null) throw new IllegalArgumentException("roomId required");
        if (senderId == null) throw new IllegalArgumentException("senderId required");
        if (dto == null) throw new IllegalArgumentException("payload required");
        if (dto.getMessageId() == null || dto.getMessageId().isBlank())
            throw new IllegalArgumentException("messageId required");
        if (dto.getType() == null)
            throw new IllegalArgumentException("type required");

        // 1) Room ACL: sender must be allowed to publish
        if (aclService != null && !aclService.canPublish(senderId, roomId)) {
            throw new IllegalArgumentException("Forbidden: cannot publish to room " + roomId);
        }

        // 2) 1:1 block policy (optional but recommended)
        if (directPolicy != null && directPolicy.isDirect(roomId)) {
            Long peer = directPolicy.peer(roomId, senderId);
            if (!directPolicy.maySend(senderId, peer)) {
                throw new IllegalArgumentException("Forbidden: sender is blocked");
            }
        }

        // 3) Idempotency: if this messageId already exists for the room, return it
        Optional<ChatMessage> existing = chatMessageRepository.findByRoomIdAndMessageId(roomId, dto.getMessageId());
        if (existing.isPresent()) return existing.get();

        // 4) Build entity from DTO (+ E2EE envelope rules)
        ChatMessage msg = new ChatMessage();
        msg.setRoomId(roomId);
        msg.setSenderId(senderId);
        msg.setMessageId(dto.getMessageId());
        msg.setType(dto.getType());
        msg.setServerTs(Instant.now());

        boolean e2ee = dto.isE2ee(); // <- your ChatSendDto should expose isE2ee() (primitive boolean)
        if (e2ee) {
            if (dto.getBody() != null && !dto.getBody().isBlank()) {
                throw new IllegalArgumentException("Plaintext body not allowed when e2ee=true");
            }
            msg.setE2ee(true);
            msg.setE2eeVer(dto.getE2eeVer() == null ? 1 : dto.getE2eeVer());
            msg.setAlgo(dto.getAlgo());
            msg.setAad(dto.getAad());
            msg.setIv(dto.getIv());
            msg.setCiphertext(dto.getCiphertext());
            msg.setKeyRef(dto.getKeyRef());
            msg.setBody(null);
        } else {
            msg.setE2ee(false);
            msg.setBody(dto.getBody());
            // (Optional) basic size check to avoid giant frames:
            if (msg.getBody() != null && msg.getBody().length() > 10_000) {
                throw new IllegalArgumentException("Message too large");
            }
        }

        // 5) Persist (tolerate race duplicates)
        ChatMessage saved;
        try {
            saved = chatMessageRepository.save(msg);
        } catch (DataIntegrityViolationException dup) {
            // Another node/thread beat us — load and return the existing row
            return chatMessageRepository.findByRoomIdAndMessageId(roomId, dto.getMessageId())
                    .orElseThrow(() -> new RuntimeException("Duplicate detected but message not found"));
        }

        // 6) Fire notification to other members (don’t fail the write if notify breaks)
        try {
            if (eventPublisher != null && membership != null) {
                java.util.List<Long> recipients = new java.util.ArrayList<>(membership.memberIds(roomId));
                recipients.removeIf(id -> id.equals(senderId)); // exclude author

                String preview = null;
                if (!saved.isE2ee() && saved.getBody() != null && !saved.getBody().isBlank()) {
                    String b = saved.getBody();
                    preview = b.length() > 140 ? b.substring(0, 140) : b;
                }

                eventPublisher.publishNewMessage(
                        roomId,
                        saved.getMessageId(),
                        senderId,
                        recipients,
                        saved.isE2ee(),
                        preview
                );
            }
        } catch (Exception notifyEx) {
            // Do not rollback the message just because notifications failed
            org.slf4j.LoggerFactory.getLogger(getClass())
                    .warn("notify failure room={} msg={} err={}", roomId, dto.getMessageId(), notifyEx.toString());
        }

        return saved;
    }

    public interface DirectRoomPolicy {
        boolean isDirect(Long roomId);
        Long peer(Long roomId, Long userId);
        boolean maySend(Long senderId, Long peerUserId);
    }

    public MessageDto handlePrivateMessage(MessageDto dto) throws AccessDeniedException {
        String senderId = dto.getSenderId();
        Long receiverId = Long.valueOf(dto.getReceiverId());

        if (dto.getMessageId() == null || dto.getMessageId().isBlank()) {
            throw new IllegalArgumentException("messageId required");
        }

        // Idempotency check: if message already exists, avoid duplicates
        java.util.Optional<Message> existing = messageRepository.findByMessageId(dto.getMessageId());
        if (existing.isPresent()) {
            return toDto(existing.get());
        }


        // Block check: Prevent sender OR receiver from communicating
        if (blockService.isBlocked(senderId, String.valueOf(receiverId))) {

            throw new AccessDeniedException("Messaging blocked between users.");
        }

        // Convert DTO to entity
        Message entity = new Message();
        entity.setSenderId(dto.getSenderId());
        entity.setReceiverId(dto.getReceiverId());
        entity.setType(dto.getType());
        entity.setContent(dto.getContent());
        entity.setMetadata(dto.getMetadata());
        entity.setGroupMessage(false);
        entity.setTimestamp(LocalDateTime.now());
        entity.setMessageId(dto.getMessageId());

        // Save to DB
        Message saved = messageRepository.save(entity);

        eventPublisher.publish(
                new EventMessage(
                        UUID.fromString(String.valueOf(receiverId)),
                        "NEW_MESSAGE",
                        Map.of(
                                "senderId", senderId,
                                "content", dto.getContent(),
                                "timestamp", saved.getTimestamp().toString()
                        )
                )
        );

        // Deliver to each active session for the receiver; if no session or a send
        // fails, record the undelivered message for later inspection.
        Long receiverUserId = Long.valueOf(receiverId);
        Set<WebSocketSession> sessions = sessionRegistry.getSessions(receiverUserId);
        if (sessions.isEmpty()) {
            undeliveredStore.record(receiverUserId, String.valueOf(saved.getId()),
                    new IllegalStateException("no active session"));
        } else {
            for (WebSocketSession s : sessions) {
                try {
                    Map<String, Object> headers =
                            Collections.singletonMap(SimpMessageHeaderAccessor.SESSION_ID_HEADER, s.getId());
                    messagingTemplate.convertAndSendToUser(String.valueOf(receiverId),
                            "/queue/private", dto, headers);
                } catch (Exception ex) {
                    undeliveredStore.record(receiverUserId, String.valueOf(saved.getId()), ex);
                }
            }
        }


        // Optionally, send to sender (ack/echo)
        messagingTemplate.convertAndSendToUser(
                 dto.getSenderId(),
                "/queue/private",
                 dto
        );

        return dto;

    }

    public MessageDto toDto(Message message) {
        MessageDto dto = new MessageDto();
        dto.setId(message.getId());
        dto.setSenderId(message.getSenderId());
        dto.setReceiverId(message.getReceiverId());
        dto.setContent(message.getContent());
        dto.setType(message.getType());
        dto.setTimestamp(message.getTimestamp());
        dto.setGroupMessage(message.getGroupMessage());
        dto.setMessageId(message.getMessageId());
        return dto;
    }

    public MessageDto saveCallInvite(MessageDto messageDto) throws AccessDeniedException {

        String senderId = messageDto.getSenderId();
        String receiverId = messageDto.getReceiverId();

        if (blockService.isBlocked(senderId, receiverId)) {
            throw new AccessDeniedException("Call invite blocked between users.");
        }


        // Only allow AUDIO_CALL_INVITE or VIDEO_CALL_INVITE
        if (messageDto.getType() != MessageType.AUDIO_CALL_INVITE &&
                messageDto.getType() != MessageType.VIDEO_CALL_INVITE) {
            throw new IllegalArgumentException("Invalid message type for call invite");
        }

        Message message = new Message();
        message.setSenderId(messageDto.getSenderId());
        message.setReceiverId(messageDto.getReceiverId());
        message.setType(messageDto.getType());
        message.setContent(messageDto.getContent());     // Optional: call room ID or null
        message.setMetadata(messageDto.getMetadata());   // Optional: device info, etc.
        message.setTimestamp(LocalDateTime.now());

        message.setGroupMessage(false);                // Call invites are one-to-one

        Message saved = messageRepository.save(message);

        eventPublisher.publish(new EventMessage(
                UUID.fromString(receiverId),
                "CALL_INVITE",
                Map.of(
                        "senderId", senderId,
                        "callType", messageDto.getType().toString(),
                        "messageId", saved.getId(),
                        "content", messageDto.getContent()
                )
        ));


        return toDto(saved);
    }


    public List<MessageDto> getConversation(String currentUserId, String otherUserId) {
        List<Message> messages = messageRepository.findConversationBetween(currentUserId, otherUserId);
        return messages.stream()
                .filter(m -> {
                    if (m.isDeletedForEveryone()) return false; // globally deleted

                    if (currentUserId.equals(m.getSenderId())) {
                        return !m.isDeletedBySender(); // not hidden by sender
                    } else if (currentUserId.equals(m.getReceiverId())) {
                        return !m.isDeletedByReceiver(); // not hidden by receiver
                    }
                    return false;
                })
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public void deleteMessageForMe(Long messageId, String userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (userId.equals(message.getSenderId())) {
            message.setDeletedBySender(true);
        } else if (userId.equals(message.getReceiverId())) {
            message.setDeletedByReceiver(true);
        } else {
            throw new RuntimeException("User not authorized");
        }

        messageRepository.save(message);
    }

    public void deleteMessageForEveryone(Long messageId, String userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!userId.equals(message.getSenderId())) {
            throw new RuntimeException("Only sender can delete for everyone");
        }

        message.setDeletedBySender(true);
        message.setDeletedByReceiver(true);
        message.setDeletedForEveryone(true);
        message.setContent("This message was deleted");
        message.setMetadata(null); // Optionally clear media info

        messageRepository.save(message);
    }




    private Message toEntity(MessageDto messageDto) {
        Message message = new Message();
        message.setGroupMessage(messageDto.getGroupMessage());
        message.setType(messageDto.getType());
        message.setSenderId(messageDto.getSenderId());
        message.setDeletedForEveryone(false);
        message.setDeletedByReceiver(false);
        message.setDeletedBySender(false);
        message.setContent(messageDto.getContent());
        message.setMetadata(messageDto.getMetadata());
        message.setTimestamp(messageDto.getTimestamp());
        message.setReceiverId(messageDto.getReceiverId());
        message.setMessageId(messageDto.getMessageId());

        return message;
    }

    public CallRoom createCallRoom(String roomId, CallType callType) {
        CallRoom callRoom = new CallRoom();
        callRoom.setRoomId(UUID.randomUUID().toString());
        callRoom.setCallType(callType);
        callRoom.setCreatedAt(LocalDateTime.now());
        return callRoomRepository.save(callRoom);
    }



    public void deleteMessageForUser(Long messageId, String userId) {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        msg.getDeletedByUserIds().add(userId);
        messageRepository.save(msg);
    }

    public void deleteForEveryone(Long messageId, String userId) throws AccessDeniedException {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!msg.getSenderId().equals(userId)) {
            throw new AccessDeniedException("Only sender can delete for everyone");
        }

        msg.setDeletedForEveryone(true);
        messageRepository.save(msg);
    }

    public List<MessageDto> getGroupMessageHistory(String chatRoomId, String currentUserId) {
        List<Message> messages = messageRepository.findByReceiverIdAndIsGroupMessageTrue(chatRoomId);

        return messages.stream()
                .filter(m ->
                        !Boolean.TRUE.equals(m.isDeletedForEveryone()) &&
                                !m.getDeletedByUserIds().contains(currentUserId)
                )
                .map(this::toDto)
                .collect(Collectors.toList());
    }





    /** Stable broadcast/event shape for subscribers (ascending compatible). */
    public Map<String, Object> toRoomEvent(ChatMessage m) {
        Map<String, Object> e = new HashMap<>();
        e.put("roomId", m.getRoomId());
        e.put("messageId", m.getMessageId());
        e.put("senderId", m.getSenderId());
        e.put("type", m.getType().name());
        e.put("serverTs", m.getServerTs());
        e.put("e2ee", m.isE2ee());
        if (m.isE2ee()) {
            e.put("e2eeVer", m.getE2eeVer());
            e.put("algo", m.getAlgo());
            e.put("aad", m.getAad());
            e.put("iv", m.getIv());
            e.put("ciphertext", m.getCiphertext());
            e.put("keyRef", m.getKeyRef());
        } else {
            e.put("body", m.getBody());
        }
        return e;
    }


}
