package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.models.UserRoomState;
import com.om.Real_Time_Communication.service.ReadReceiptService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Controller
public class ReadReceiptController {

    private final ReadReceiptService service;

    public ReadReceiptController(ReadReceiptService service, SimpMessagingTemplate messaging) {
        this.service = service;
        this.messaging = messaging;
    }

    private final SimpMessagingTemplate messaging;

    @Data
    public static class ReadDto { private String lastReadMessageId;

        public String getLastReadMessageId() {
            return lastReadMessageId;
        }

        public void setLastReadMessageId(String lastReadMessageId) {
            this.lastReadMessageId = lastReadMessageId;
        }
    }

    /** Client SENDs to /app/room.{roomId}.read with {lastReadMessageId} */
    @MessageMapping("/room/{roomId}/read")
    public void read(@DestinationVariable Long roomId, ReadDto dto, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        UserRoomState state = service.updateLastRead(userId, roomId, dto.getLastReadMessageId());

        // (optional) broadcast to room so others can show read markers
        Map<String,Object> ev = new HashMap<String,Object>();
        ev.put("type", "read");
        ev.put("userId", userId);
        ev.put("roomId", roomId);
        ev.put("lastReadMessageId", state.getLastReadMessageId());
        ev.put("lastReadAt", state.getLastReadAt());
        messaging.convertAndSend("/topic/room/"+roomId+"/reads", ev);
    }
}