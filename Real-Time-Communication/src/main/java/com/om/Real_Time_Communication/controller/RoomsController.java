// RoomsController.java  (merge ChatRoomController + RoomMessagesController [+ room-scoped bits])
package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.*;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.Role;
import com.om.Real_Time_Communication.service.ChatRoomService;
import com.om.Real_Time_Communication.service.MessagePagingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.nio.file.AccessDeniedException;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")

@CrossOrigin(origins = "${cors.allowed-origins}")
public class RoomsController {
    private final ChatRoomService chatRoomService;
    // private final MessageService messageService;
    // private final ReadReceiptService readReceiptService;

    private final MessagePagingService paging;
    private final MessageDtoMapper mapper; // map entity -> DTO
    private final ChatRoomService acl; // already discussed

    public RoomsController(ChatRoomService chatRoomService, MessagePagingService paging, MessageDtoMapper mapper, ChatRoomService acl) {
        this.chatRoomService = chatRoomService;
        this.paging = paging;
        this.mapper = mapper;
        this.acl = acl;
    }

    // ===== from ChatRoomController =====

    @PostMapping("/create-group")
    public ResponseEntity<ChatRoom> createGroupChat(@RequestBody CreateGroupRequest request,
                                                    Principal principal) {
        String creatorId = principal.getName(); // comes from JWT principal
        ChatRoom chatRoom = chatRoomService.createGroupChat(
                request.getGroupName(), request.getParticipantPhoneNumbers(), creatorId);
        return ResponseEntity.ok(chatRoom);
    }

    @PostMapping("/direct")
    public ResponseEntity<ChatRoom> createDirectChat(@RequestBody CreateDirectChatRequest request,
                                                     Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        ChatRoom room = chatRoomService.createDirectChat(userId, request.getParticipantId());
        return ResponseEntity.ok(room);
    }

    @PutMapping("/{roomId}/update-metadata")
    public ResponseEntity<ChatRoom> updateGroupMetadata(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @RequestBody GroupMetadataUpdateRequest request) throws AccessDeniedException {
        ChatRoom updated = chatRoomService.updateGroupMetadata(Long.valueOf(userId), roomId, request);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{roomId}/metadata")
    public ResponseEntity<ChatRoom> updateMetadata(
            @PathVariable String roomId,
            @RequestBody GroupMetadataUpdateRequest request,
            @RequestHeader("X-User-Id") String userId) throws AccessDeniedException {


        ChatRoom updatedRoom = chatRoomService.updateGroupMetadata(Long.valueOf(userId), roomId, request);
        return ResponseEntity.ok(updatedRoom);
    }

    @PutMapping("/{roomId}/toggle-metadata-editing")
    public ResponseEntity<Void> toggleMetadataEditing(
            @PathVariable String roomId,
            @RequestParam boolean allow,
            Principal principal) throws AccessDeniedException {

        String adminId = principal.getName();
        chatRoomService.toggleMetadataEditing(adminId, roomId, allow);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{roomId}/leave")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable Long roomId,
            Principal principal) {

        String userId = principal.getName();
        chatRoomService.leaveGroup(Long.valueOf(userId), roomId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{roomId}/members/{targetUserId}/role")
    public ResponseEntity<Void> changeMemberRole(
            @PathVariable String roomId,
            @PathVariable Long targetUserId,
            @RequestParam Role newRole,
            Principal principal) throws AccessDeniedException {

        String adminId = principal.getName();
        chatRoomService.changeMemberRole(Long.valueOf(adminId), targetUserId, roomId, newRole);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{roomId}/members/{userIdToRemove}")
    public ResponseEntity<Void> removeMember(
            @PathVariable Long roomId,
            @PathVariable Long userIdToRemove,
            Principal principal) throws AccessDeniedException {

        String adminId = principal.getName();
        chatRoomService.removeMember(adminId, userIdToRemove, roomId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{roomId}/toggle-add-members")
    public ResponseEntity<Void> toggleAllowMemberstoAdd(
            @PathVariable Long roomId,
            @RequestParam boolean allow,
            Principal principal) throws AccessDeniedException {

        String adminId = principal.getName();
        chatRoomService.toggleAllowMemberstoAdd(adminId, roomId, allow);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{roomId}/members/{userIdToAdd}")
    public ResponseEntity<Void> addMember(
            @PathVariable Long roomId,
            @PathVariable Long userIdtoAdd,
            Principal principal) throws AccessDeniedException {

        String adminId = principal.getName();
        chatRoomService.addParticipantToGroup(adminId, userIdtoAdd, roomId);
        return ResponseEntity.ok().build();
    }

    // ===== from RoomMessagesController =====

    @GetMapping("/{roomId}/messages")
    public List<ChatMessageDto> list(Principal principal,
                                     @PathVariable Long roomId,
                                     @RequestParam(required = false) Instant beforeTs,
                                     @RequestParam(required = false) Long beforeId,
                                     @RequestParam(defaultValue = "50") int limit) {
        Long userId = Long.valueOf(principal.getName());
        if (!acl.canPublish(userId,roomId)) // or a dedicated canRead(...)
            throw new IllegalArgumentException("Forbidden");

        return paging.list(roomId, beforeTs, beforeId, limit)
                .stream().map(mapper::toDto).toList();
    }


    @PutMapping("/{roomId}/read")
    public Map<String, Object> markRead(Principal principal,
                                        @PathVariable Long roomId,
                                        @RequestParam String messageId) {
        Long userId = Long.valueOf(principal.getName());
        paging.markRead(roomId, userId, messageId);
        return Map.of("ok", true);
    }
//    @GetMapping("/{roomId}/messages")
//    public ResponseEntity<List<?>> listRoomMessages(@PathVariable Long roomId,
//                                                    @RequestParam(name = "beforeId", required = false) Long beforeId,
//                                                    @RequestParam(name = "limit", required = false, defaultValue = "50") int limit) {
//        //  move logic from RoomMessagesController#list
//        return ResponseEntity.ok(List.of());
//    }
//
//    @PutMapping("/{roomId}/read")
//    public ResponseEntity<Map<String, Object>> markRead(@PathVariable Long roomId,
//                                                        @RequestBody Map<String, Object> body) {
//        //  move logic from RoomMessagesController#markRead
//        return ResponseEntity.ok(Map.of("ok", true));
//    }
}
