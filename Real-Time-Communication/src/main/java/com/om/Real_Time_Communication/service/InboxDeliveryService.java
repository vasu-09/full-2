package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.Repository.MessageDeliveryRepository;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.MessageDelivery;
import com.om.Real_Time_Communication.models.MessageDeliveryStatus;
import com.om.Real_Time_Communication.security.SessionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InboxDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(InboxDeliveryService.class);

    private final MessageDeliveryRepository deliveryRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RoomMembershipService membershipService;
    private final SessionRegistry sessionRegistry;
    private final SimpMessagingTemplate messagingTemplate;
    private final MessageService messageService;

    public InboxDeliveryService(
            MessageDeliveryRepository deliveryRepository,
            ChatRoomRepository chatRoomRepository,
            ChatMessageRepository chatMessageRepository,
            RoomMembershipService membershipService,
            SessionRegistry sessionRegistry,
            SimpMessagingTemplate messagingTemplate,
            MessageService messageService
    ) {
        this.deliveryRepository = deliveryRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.membershipService = membershipService;
        this.sessionRegistry = sessionRegistry;
        this.messagingTemplate = messagingTemplate;
        this.messageService = messageService;
    }

    public void recordAndDispatch(ChatRoom room, ChatMessage saved, Map<String, Object> baseEvent, List<Long> members) {
        if (room == null || saved == null || members == null) {
            return;
        }

        for (Long memberId : members) {
            if (memberId == null || memberId.equals(saved.getSenderId())) {
                continue; // skip author
            }

            Long peerId = resolvePeerId(room, members, memberId);
            Map<String, Object> inboxPayload = buildInboxPayload(room, saved, baseEvent, peerId);

            MessageDelivery delivery = deliveryRepository.findByMsgIdAndUserId(saved.getMessageId(), memberId)
                    .orElseGet(() -> createPending(saved, room, memberId));

            boolean liveSent = sendIfOnline(memberId, inboxPayload);
            if (liveSent) {
                delivery.setStatus(MessageDeliveryStatus.SENT_TO_WS);
                deliveryRepository.save(delivery);
            }
        }
    }

    private MessageDelivery createPending(ChatMessage saved, ChatRoom room, Long memberId) {
        MessageDelivery delivery = new MessageDelivery();
        delivery.setMsgId(saved.getMessageId());
        delivery.setUserId(memberId);
        delivery.setRoomId(room.getId());
        delivery.setStatus(MessageDeliveryStatus.PENDING);
        return deliveryRepository.save(delivery);
    }

    private boolean sendIfOnline(Long memberId, Map<String, Object> payload) {
        boolean online = sessionRegistry.hasActive(memberId);
        if (!online) {
            log.info("[INBOX][PENDING] user={} offline; skipping live dispatch", memberId);
            return false;
        }
        log.info("[INBOX] send to user={} dest=/queue/inbox msgId={} roomKey={}",
                memberId, payload.get("msgId"), payload.get("roomKey"));
        messagingTemplate.convertAndSendToUser(
                String.valueOf(memberId),
                "/queue/inbox",
                payload
        );
        return true;
    }

    public List<Map<String, Object>> pendingMessages(Long userId, Instant since) {
        Collection<MessageDeliveryStatus> statuses = EnumSet.of(
                MessageDeliveryStatus.PENDING,
                MessageDeliveryStatus.SENT_TO_WS
        );

        List<MessageDelivery> deliveries = since == null
                ? deliveryRepository.findByUserIdAndStatusInOrderByCreatedAtAsc(userId, statuses)
                : deliveryRepository.findByUserIdAndStatusInAndCreatedAtAfterOrderByCreatedAtAsc(userId, statuses, since);

        List<Map<String, Object>> payloads = new ArrayList<>();
        for (MessageDelivery d : deliveries) {
            ChatRoom room = d.getRoomId() != null
                    ? chatRoomRepository.findById(d.getRoomId()).orElse(null)
                    : null;
            if (room == null) {
                continue;
            }
            ChatMessage msg = chatMessageRepository.findByRoomIdAndMessageId(room.getId(), d.getMsgId())
                    .orElse(null);
            if (msg == null) {
                continue;
            }
            List<Long> members = membershipService.memberIds(room.getId());
            Long peerId = resolvePeerId(room, members, userId);
            Map<String, Object> base = messageService.toRoomEvent(msg);
            Map<String, Object> payload = buildInboxPayload(room, msg, base, peerId);
            payloads.add(payload);

            d.setStatus(MessageDeliveryStatus.SENT_TO_WS);
            deliveryRepository.save(d);
        }
        return payloads.stream()
                .sorted(Comparator.comparing((Map<String, Object> p) ->
                        (Instant) p.getOrDefault("createdAt", Instant.EPOCH)))
                .collect(Collectors.toList());
    }

    public void markDelivered(String msgId, Long userId, String deviceId, boolean read) {
        deliveryRepository.findByMsgIdAndUserId(msgId, userId).ifPresent(delivery -> {
            delivery.setDeviceId(deviceId);
            if (read) {
                delivery.setStatus(MessageDeliveryStatus.READ);
                delivery.setReadAt(Instant.now());
            } else {
                delivery.setStatus(MessageDeliveryStatus.DELIVERED_TO_DEVICE);
                delivery.setDeliveredAt(Instant.now());
            }
            deliveryRepository.save(delivery);
        });
    }

    private Long resolvePeerId(ChatRoom room, List<Long> members, Long recipientId) {
        if (Boolean.TRUE.equals(room.getGroup())) {
            return null;
        }
        if (members == null || members.size() != 2) {
            return null;
        }
        return members.stream().filter(id -> !id.equals(recipientId)).findFirst().orElse(null);
    }

    private Map<String, Object> buildInboxPayload(ChatRoom room, ChatMessage saved, Map<String, Object> baseEvent, Long peerId) {
        Map<String, Object> inboxEvent = new HashMap<>(baseEvent == null ? Collections.emptyMap() : baseEvent);
        inboxEvent.put("type", "message");
        inboxEvent.put("roomKey", room.getRoomId());
        inboxEvent.put("roomName", room.getName());
        inboxEvent.put("roomImage", room.getImageUrl());
        inboxEvent.put("roomDbId", room.getId());
        inboxEvent.put("msgId", saved.getMessageId());
        inboxEvent.put("messageId", saved.getMessageId());
        inboxEvent.put("senderId", saved.getSenderId());
        inboxEvent.put("createdAt", saved.getServerTs());
        if (peerId != null) {
            inboxEvent.put("peerId", peerId);
        }
        return inboxEvent;
    }
}