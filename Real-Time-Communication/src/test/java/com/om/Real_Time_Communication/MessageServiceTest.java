package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.MessageRepository;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.Message;
import com.om.Real_Time_Communication.models.MessageType;
import com.om.Real_Time_Communication.security.SessionRegistry;
import com.om.Real_Time_Communication.service.*;
import com.om.Real_Time_Communication.service.MessageService.DirectRoomPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock MessageRepository messageRepository;
    @Mock BlockService blockService;
    @Mock EventPublisher eventPublisher;
    @Mock SimpMessagingTemplate messagingTemplate;
    @Mock SessionRegistry sessionRegistry;

    // Dependencies for saveInbound
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock ChatRoomService aclService;
    @Mock DirectRoomPolicy directPolicy;
    @Mock RoomMembershipService membership;

    @InjectMocks
    MessageService service;

    @BeforeEach
    void setup() {
        when(blockService.isBlocked(anyString(), anyString())).thenReturn(false);
    }

    @Test
    void handlePrivateMessage_sendsToOnlineUser() throws Exception {
        when(messageRepository.findByMessageId("m1")).thenReturn(Optional.empty());
        Message saved = new Message();
        saved.setId(1L);
        saved.setSenderId("1");
        saved.setReceiverId("2");
        saved.setContent("hi");
        saved.setMessageId("m1");
        saved.setTimestamp(LocalDateTime.now());
        when(messageRepository.save(any())).thenReturn(saved);
        when(sessionRegistry.hasActive(2L)).thenReturn(true);

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("2");
        dto.setContent("hi");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m1");

        MessageDto result = service.handlePrivateMessage(dto);
        assertEquals("m1", result.getMessageId());

        verify(messagingTemplate).convertAndSendToUser(eq("2"), anyString(), eq(dto));
        verify(messagingTemplate).convertAndSendToUser(eq("1"), anyString(), eq(dto));
        verify(eventPublisher, never()).publishOfflineMessage(anyString(), any());
    }

    @Test
    void handlePrivateMessage_publishesOfflineWhenUserOffline() throws Exception {
        when(messageRepository.findByMessageId("m2")).thenReturn(Optional.empty());
        Message saved = new Message();
        saved.setId(2L);
        saved.setSenderId("1");
        saved.setReceiverId("3");
        saved.setContent("yo");
        saved.setMessageId("m2");
        saved.setTimestamp(LocalDateTime.now());
        when(messageRepository.save(any())).thenReturn(saved);
        when(sessionRegistry.hasActive(3L)).thenReturn(false);

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("3");
        dto.setContent("yo");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m2");

        service.handlePrivateMessage(dto);

        verify(eventPublisher).publishOfflineMessage("3", dto);
        verify(messagingTemplate).convertAndSendToUser(eq("1"), anyString(), eq(dto));
        verify(messagingTemplate, never()).convertAndSendToUser(eq("3"), anyString(), eq(dto));
    }

    @Test
    void handlePrivateMessage_doesNotDuplicate() throws Exception {
        Message existing = new Message();
        existing.setMessageId("m3");
        when(messageRepository.findByMessageId("m3")).thenReturn(Optional.of(existing));

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("2");
        dto.setContent("dup");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m3");

        service.handlePrivateMessage(dto);

        verify(messageRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
        verify(eventPublisher, never()).publishOfflineMessage(anyString(), any());
    }

    @Test
    void saveInbound_publishesToRecipients() {
        ChatSendDto dto = new ChatSendDto();
        dto.setMessageId("g1");
        dto.setType(MessageType.TEXT);
        dto.setBody("hello group");

        ChatMessage saved = new ChatMessage();
        saved.setMessageId("g1");
        saved.setRoomId(10L);
        saved.setSenderId(1L);
        saved.setServerTs(Instant.now());
        saved.setType(MessageType.TEXT);
        when(chatMessageRepository.findByRoomIdAndMessageId(10L, "g1")).thenReturn(Optional.empty());
        when(chatMessageRepository.save(any())).thenReturn(saved);
        when(aclService.canPublish(1L, Long.valueOf("10"))).thenReturn(true);
        when(directPolicy.isDirect(10L)).thenReturn(false);
        when(membership.memberIds(10L)).thenReturn(List.of(1L,2L,3L));

        service.saveInbound(10L, 1L, dto);

        ArgumentCaptor<List<Long>> captor = ArgumentCaptor.forClass(List.class);
        verify(eventPublisher).publishNewMessage(eq(10L), eq("g1"), eq(1L), captor.capture(), eq(false), any());
        assertEquals(List.of(2L,3L), captor.getValue());
    }
}

