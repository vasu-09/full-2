package com.om.Notification_Service.client;

import com.om.Notification_Service.dto.ChatMessageDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "Real-Time-Communication",  contextId = "chatMessageClient", path = "/api/chat/messages")
public interface ChatMessageService {

    @PostMapping
    ChatMessageDto save(@RequestBody ChatMessageDto msg);

    @PostMapping("/broadcast")
    void broadcast(@RequestBody ChatMessageDto msg);
}
