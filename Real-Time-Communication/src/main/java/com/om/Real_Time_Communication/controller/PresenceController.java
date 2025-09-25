package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.presence.PresenceRegistry;
import com.om.Real_Time_Communication.presence.TypingRegistry;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Controller

public class PresenceController {

    private final PresenceRegistry registry;
    private final SimpMessagingTemplate messaging;

    public PresenceController(PresenceRegistry registry, SimpMessagingTemplate messaging) {
        this.registry = registry;
        this.messaging = messaging;
    }

    private static final long TTL_MS = 5_000L;

    @Autowired
    private  TypingRegistry typing;


    @Data
    public static class TypingDto {
        private String deviceId;
        private boolean typing;

        public String getDeviceId() {
            return deviceId;
        }

        public void setDeviceId(String deviceId) {
            this.deviceId = deviceId;
        }

        public boolean isTyping() {
            return typing;
        }

        public void setTyping(boolean typing) {
            this.typing = typing;
        }
    }

    @Data
    public static class PingDto { private String deviceId;

        public String getDeviceId() {
            return deviceId;
        }

        public void setDeviceId(String deviceId) {
            this.deviceId = deviceId;
        }
    }

    /** Client SENDs to /app/room.{roomId}.ping every ~15s with {deviceId} */
    @MessageMapping("/room/{roomId}/ping")
    public void ping(@DestinationVariable Long roomId, PingDto dto, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        String deviceId = dto.getDeviceId() != null ? dto.getDeviceId() : "default";
        PresenceRegistry.Presence p = registry.touch(userId, deviceId);

        // Broadcast presence (room-scoped)
        Map<String,Object> ev = new HashMap<String,Object>();
        ev.put("type", "presence");
        ev.put("userId", userId);
        ev.put("deviceId", deviceId);
        ev.put("online", true);
        ev.put("lastSeen", Instant.now());
        messaging.convertAndSend("/topic/room/"+roomId+"/presence", ev);
    }



    /** Client SENDs to /app/room.{roomId}.typing with {deviceId, typing:true/false} */
    @MessageMapping("/room/{roomId}/typing")
    public void typing(@DestinationVariable Long roomId, TypingDto dto, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        String deviceId = dto.getDeviceId() != null ? dto.getDeviceId() : "default";

        Map<String,Object> ev = new HashMap<String,Object>();
        ev.put("type", "typing");
        ev.put("userId", userId);
        ev.put("deviceId", deviceId);

        if (dto.isTyping()) {
            Instant expiresAt = typing.start(roomId, userId, deviceId, TTL_MS);
            ev.put("typing", true);
            ev.put("expiresAt", expiresAt);
        } else {
            typing.stop(roomId, userId, deviceId);
            ev.put("typing", false);
        }

        // Broadcast to room subscribers only
        messaging.convertAndSend("/topic/room/"+roomId+"/typing", ev);
    }
}