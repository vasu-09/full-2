package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
public class ChatMessageDto {
    private Long roomId;
    private String messageId;
    private Long senderId;
    private MessageType type;
    private Instant serverTs;

    // Non-E2EE
    private String body;

    // E2EE envelope
    private boolean e2ee;
    private Short e2eeVer;
    private String algo;
    private byte[] aad;
    private byte[] iv;
    private byte[] ciphertext;
    private String keyRef;

    public Long getRoomId() {
        return roomId;
    }

    public void setRoomId(Long roomId) {
        this.roomId = roomId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public Instant getServerTs() {
        return serverTs;
    }

    public void setServerTs(Instant serverTs) {
        this.serverTs = serverTs;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public boolean isE2ee() {
        return e2ee;
    }

    public void setE2ee(boolean e2ee) {
        this.e2ee = e2ee;
    }

    public Short getE2eeVer() {
        return e2eeVer;
    }

    public void setE2eeVer(Short e2eeVer) {
        this.e2eeVer = e2eeVer;
    }

    public String getAlgo() {
        return algo;
    }

    public void setAlgo(String algo) {
        this.algo = algo;
    }

    public byte[] getAad() {
        return aad;
    }

    public void setAad(byte[] aad) {
        this.aad = aad;
    }

    public byte[] getIv() {
        return iv;
    }

    public void setIv(byte[] iv) {
        this.iv = iv;
    }

    public byte[] getCiphertext() {
        return ciphertext;
    }

    public void setCiphertext(byte[] ciphertext) {
        this.ciphertext = ciphertext;
    }

    public String getKeyRef() {
        return keyRef;
    }

    public void setKeyRef(String keyRef) {
        this.keyRef = keyRef;
    }

    public static ChatMessageDto fromEntity(ChatMessage entity) {
        return ChatMessageDto.builder().messageId(entity.getMessageId())
                .roomId(entity.getRoomId())
                .senderId(entity.getSenderId())
                .type(entity.getType())
                .serverTs(entity.getServerTs())
                .body(entity.getBody())
                .e2ee(entity.isE2ee())
                .e2eeVer(entity.getE2eeVer())
                .algo(entity.getAlgo())
                .aad(entity.getAad())
                .iv(entity.getIv())
                .ciphertext(entity.getCiphertext())
                .keyRef(entity.getKeyRef())
                .build();
    }

    public ChatMessageDto() {} // optional empty ctor

    private ChatMessageDto(Builder b) {
        this.roomId = b.roomId;
        this.messageId = b.messageId;
        this.senderId = b.senderId;
        this.type = b.type;
        this.serverTs = b.serverTs;
        this.body = b.body;
        this.e2ee = b.e2ee;
        this.e2eeVer = b.e2eeVer;
        this.algo = b.algo;
        this.aad = b.aad;
        this.iv = b.iv;
        this.ciphertext = b.ciphertext;
        this.keyRef = b.keyRef;
    }

    public static Builder builder() { return new Builder(); }

    public Builder toBuilder() {
        return new Builder()
                .roomId(roomId)
                .messageId(messageId)
                .senderId(senderId)
                .type(type)
                .serverTs(serverTs)
                .body(body)
                .e2ee(e2ee)
                .e2eeVer(e2eeVer)
                .algo(algo)
                .aad(aad)
                .iv(iv)
                .ciphertext(ciphertext)
                .keyRef(keyRef);
    }

    public static final class Builder {
        private Long roomId;
        private String messageId;
        private Long senderId;
        private MessageType type;
        private Instant serverTs;
        private String body;
        private boolean e2ee;
        private Short e2eeVer;
        private String algo;
        private byte[] aad;
        private byte[] iv;
        private byte[] ciphertext;
        private String keyRef;

        public Builder roomId(Long roomId) { this.roomId = roomId; return this; }
        public Builder messageId(String messageId) { this.messageId = messageId; return this; }
        public Builder senderId(Long senderId) { this.senderId = senderId; return this; }
        public Builder type(MessageType type) { this.type = type; return this; }
        public Builder serverTs(Instant serverTs) { this.serverTs = serverTs; return this; }
        public Builder body(String body) { this.body = body; return this; }
        public Builder e2ee(boolean e2ee) { this.e2ee = e2ee; return this; }
        public Builder e2eeVer(Short e2eeVer) { this.e2eeVer = e2eeVer; return this; }
        public Builder algo(String algo) { this.algo = algo; return this; }
        public Builder aad(byte[] aad) { this.aad = aad; return this; }
        public Builder iv(byte[] iv) { this.iv = iv; return this; }
        public Builder ciphertext(byte[] ciphertext) { this.ciphertext = ciphertext; return this; }
        public Builder keyRef(String keyRef) { this.keyRef = keyRef; return this; }

        public ChatMessageDto build() { return new ChatMessageDto(this); }
    }

    // Getters / Setters (kept so your existing code keeps working)


}
