package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_room_participants")
@Setter
@Getter
@Builder
@AllArgsConstructor
public class ChatRoomParticipant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @ManyToOne
    @JoinColumn(name = "chat_room_id")
    private ChatRoom chatRoom;

    private LocalDateTime joinedAt;


    @Enumerated(EnumType.STRING)
    private Role role = Role.MEMBER;

    @Column(name = "last_read_message_id")
    private String lastReadMessageId;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public ChatRoom getChatRoom() {
        return chatRoom;
    }

    public void setChatRoom(ChatRoom chatRoom) {
        this.chatRoom = chatRoom;
    }

    public LocalDateTime getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(LocalDateTime joinedAt) {
        this.joinedAt = joinedAt;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public ChatRoomParticipant(){}
    private ChatRoomParticipant(Builder b) {
        this.id = b.id;
        this.userId = b.userId;
        this.chatRoom = b.chatRoom;
        this.joinedAt = b.joinedAt;
        this.role = b.role;
    }

    public static Builder builder() { return new Builder(); }

    public Builder toBuilder() {
        return new Builder()
                .id(id)
                .userId(userId)
                .chatRoom(chatRoom)
                .joinedAt(joinedAt)
                .role(role);
    }

    public static final class Builder {
        private Long id;
        private Long userId;
        private ChatRoom chatRoom;
        private LocalDateTime joinedAt;
        private Role role = Role.MEMBER; // keep default

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder chatRoom(ChatRoom chatRoom) { this.chatRoom = chatRoom; return this; }
        public Builder joinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; return this; }
        public Builder role(Role role) { this.role = role; return this; }

        public ChatRoomParticipant build() { return new ChatRoomParticipant(this); }
    }

}