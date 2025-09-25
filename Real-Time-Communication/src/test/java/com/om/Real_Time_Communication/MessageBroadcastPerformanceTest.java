package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.controller.MessageController;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.MessageType;
import com.om.Real_Time_Communication.service.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.ExecutorSubscribableChannel;
import org.springframework.scheduling.concurrent.ConcurrentTaskExecutor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.core.task.TaskExecutor;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Simple load test that simulates 100 users each sending 20 messages
 * rapidly to the MessageController.
 */
public class MessageBroadcastPerformanceTest {

    @Test
    void simulateConcurrentSend() throws Exception {
        // Mock dependencies
        MessageService service = mock(MessageService.class);
        ChatMessage saved = new ChatMessage();
        saved.setRoomId(1L);
        saved.setMessageId("id");
        when(service.saveInbound(anyLong(), anyLong(), any(ChatSendDto.class))).thenReturn(saved);
        when(service.toRoomEvent(any(ChatMessage.class))).thenReturn(Map.of("type", "test"));

        // Real messaging template with in-memory channel
        SimpMessagingTemplate template = new SimpMessagingTemplate(new ExecutorSubscribableChannel());
        TaskExecutor executor = new ConcurrentTaskExecutor(Executors.newFixedThreadPool(8));

        MessageController controller = new MessageController();
        ReflectionTestUtils.setField(controller, "messageService", service);
        ReflectionTestUtils.setField(controller, "messagingTemplate", template);
        ReflectionTestUtils.setField(controller, "messageTaskExecutor", executor);

        int users = 100;
        int messagesPerUser = 20;
        ExecutorService pool = Executors.newFixedThreadPool(32);
        CountDownLatch latch = new CountDownLatch(users);

        for (int u = 0; u < users; u++) {
            final long userId = u;
            pool.submit(() -> {
                Principal p = () -> String.valueOf(userId);
                for (int m = 0; m < messagesPerUser; m++) {
                    ChatSendDto dto = new ChatSendDto();
                    dto.setMessageId(UUID.randomUUID().toString());
                    dto.setType(MessageType.TEXT);
                    controller.sendToRoom(1L, dto, p, null);
                }
                latch.countDown();
            });
        }

        latch.await();
        pool.shutdown();
    }
}