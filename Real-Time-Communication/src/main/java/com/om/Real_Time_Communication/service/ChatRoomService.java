package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.Repository.MessageRepository;
import com.om.Real_Time_Communication.client.UserServiceClient;
import com.om.Real_Time_Communication.dto.*;
import com.om.Real_Time_Communication.models.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;

import java.nio.file.AccessDeniedException;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ChatRoomService {

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatRoomParticipantRepository participantRepository;

    @Autowired
    private UserServiceClient userServiceClient;



    private static final int MAX_GROUP_MEMBERS = 100;


    public ChatRoom createGroupChat(String groupName, List<String> phoneNumbers, String creatorId) {

        if (phoneNumbers.size() > MAX_GROUP_MEMBERS) {
            throw new IllegalArgumentException("Group cannot have more than " + MAX_GROUP_MEMBERS + " members.");
        }
        // Step 1: Resolve userIds from phoneNumbers via Feign
        List<Long> userIds = userServiceClient
                .getUserIdsByPhoneNumbers(phoneNumbers)
                .getBody();

        // Step 2: Create chat room
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setRoomId(UUID.randomUUID().toString());
        chatRoom.setName(groupName);
        chatRoom.setType(ChatRoomType.GROUP);
        chatRoom.setGroup(true);
        chatRoom.setAllowMembersToAddMembers(true);
        chatRoom.setAllowMembersToEditMetadata(true);
        chatRoom.setCreatedAt(LocalDateTime.now());

        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);

        // Step 3: Add participants (including creator)
        Set<String> allParticipants = new HashSet<>(phoneNumbers);
        allParticipants.add(creatorId); // ensure creator is added

        for (Long userId : userIds) {
            ChatRoomParticipant participant = new ChatRoomParticipant();
            if(String.valueOf(userId) == creatorId){
            participant.setUserId(userId);
            participant.setChatRoom(savedRoom);
            participant.setJoinedAt(LocalDateTime.now());
            participant.setRole(Role.ADMIN);
                participantRepository.save(participant);
            }else{
                participant.setUserId(userId);
                participant.setChatRoom(savedRoom);
                participant.setJoinedAt(LocalDateTime.now());
                participant.setRole(Role.MEMBER);
                participantRepository.save(participant);
            }

        }

        return savedRoom;
    }

    public ChatRoom createDirectChat(Long userId, Long otherUserId) {
        Optional<ChatRoom> existing = chatRoomRepository.findDirectRoom(userId, otherUserId, ChatRoomType.DIRECT);
        if (existing.isPresent()) {
            return existing.get();
        }

        ChatRoom room = new ChatRoom();
        room.setRoomId(UUID.randomUUID().toString());
        room.setType(ChatRoomType.DIRECT);
        room.setGroup(false);
        room.setAllowMembersToAddMembers(false);
        room.setAllowMembersToEditMetadata(false);
        room.setCreatedAt(LocalDateTime.now());

        ChatRoom saved = chatRoomRepository.save(room);

        ChatRoomParticipant p1 = new ChatRoomParticipant();
        p1.setUserId(userId);
        p1.setChatRoom(saved);
        p1.setJoinedAt(LocalDateTime.now());

        ChatRoomParticipant p2 = new ChatRoomParticipant();
        p2.setUserId(otherUserId);
        p2.setChatRoom(saved);
        p2.setJoinedAt(LocalDateTime.now());

        participantRepository.saveAll(List.of(p1, p2));
        return saved;
    }

    public ChatRoom updateGroupMetadata(Long userId, String roomId, GroupMetadataUpdateRequest request) throws AccessDeniedException {
        ChatRoom room = chatRoomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant participant = participantRepository.findByUserIdAndChatRoom(userId, room)
                .orElseThrow(() -> new RuntimeException("User is not part of the group"));

        boolean isAdmin = participant.getRole() == Role.ADMIN;

        if (!isAdmin && !room.isAllowMembersToEditMetadata()) {
            throw new AccessDeniedException("Only admins can update metadata");
        }

        if (request.getName() != null) room.setName(request.getName());
        if (request.getDescription() != null) room.setDescription(request.getDescription());
        if (request.getImageUrl() != null) room.setImageUrl(request.getImageUrl());
        room.setUpdatedAt(LocalDateTime.now());

        return chatRoomRepository.save(room);
    }


    public void changeMemberRole(Long adminId, Long targetUserId, String roomId, Role newRole) throws AccessDeniedException {
        ChatRoom room = chatRoomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant admin = participantRepository.findByUserIdAndChatRoom(adminId, room).orElseThrow(() -> new RuntimeException("Admin not found"));

        if (admin.getRole() != Role.ADMIN)
            throw new AccessDeniedException("Only admins can change roles");

        ChatRoomParticipant target = participantRepository.findByUserIdAndChatRoom(targetUserId, room)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        target.setRole(newRole);
        participantRepository.save(target);
    }


    public void toggleMetadataEditing(String adminId, String roomId, boolean allow) throws AccessDeniedException {
        ChatRoom room = chatRoomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant admin = participantRepository.findByUserIdAndChatRoom(Long.valueOf(adminId), room)
                .orElseThrow(() -> new RuntimeException("Admin not found"));

        if (admin.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only admins can change this setting");
        }

        room.setAllowMembersToEditMetadata(allow);
        chatRoomRepository.save(room);
    }

    public void leaveGroup(Long userId, Long roomId) {
        participantRepository.deleteByUserIdAndChatRoom(userId, roomId);
    }

    public void removeMember(String userId, Long userIdToRemove, Long roomId) throws AccessDeniedException {

        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant participant = participantRepository.findByUserIdAndChatRoom(Long.valueOf(userId), room)
                .orElseThrow(() -> new RuntimeException("User is not part of the group"));

        boolean isAdmin = participant.getRole() == Role.ADMIN;

        if (!isAdmin && !room.isAllowMembersToAddMembers()) {
            throw new AccessDeniedException("Only admins can update metadata");
        }

        // Same admin check logic
        participantRepository.deleteByUserIdAndChatRoom(userIdToRemove, roomId);
    }

    public void addParticipantToGroup(String userId, Long userToAdd, Long chatRoomId) throws AccessDeniedException {
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        long count = participantRepository.countByRoomId(chatRoomId);
        if (count >= MAX_GROUP_MEMBERS) {
            throw new IllegalStateException("Group is full. Maximum 100 participants allowed.");
        }

        ChatRoomParticipant participant1 = participantRepository.findByUserIdAndChatRoom(Long.valueOf(userId), chatRoom)
                .orElseThrow(() -> new RuntimeException("User is not part of the group"));

        boolean isAdmin = participant1.getRole() == Role.ADMIN;

        if (!isAdmin && !chatRoom.isAllowMembersToAddMembers()) {
            throw new AccessDeniedException("Only admins can update metadata");
        }
        ChatRoomParticipant participant = new ChatRoomParticipant();
        participant.setUserId(userToAdd);
        participant.setChatRoom(chatRoom);
        participant.setJoinedAt(LocalDateTime.now());
        participant.setRole(Role.MEMBER);
        participantRepository.save(participant);
    }

    public void toggleAllowMemberstoAdd(String adminId, Long roomId, boolean allow) throws AccessDeniedException {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant admin = participantRepository.findByUserIdAndChatRoom(Long.valueOf(adminId), room)
                .orElseThrow(() -> new RuntimeException("Admin not found"));

        if (admin.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only admins can change this setting");
        }

        room.setAllowMembersToAddMembers(allow);
        chatRoomRepository.save(room);
    }




    public boolean canPublish(Long userId, Long roomId) {
        // basic membership check; extend with roles/mute/ban as needed
        return participantRepository.existsByRoomIdAndUserId(roomId, userId);
    }
}
