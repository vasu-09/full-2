package com.om.Real_Time_Communication.config;

import com.om.Real_Time_Communication.security.SessionRegistry;
import com.om.Real_Time_Communication.service.PendingMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import org.springframework.context.annotation.Lazy;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final StompSecurityInterceptor stompSecurityInterceptor;
    private final InboundSizeAndRateInterceptor inboundSizeAndRateInterceptor;
    private final OutboundFloodGuardInterceptor outboundFloodGuardInterceptor;
    private final SessionRegistry sessionRegistry;
    private final PendingMessageService pendingMessages;

    public WebSocketConfig(JwtHandshakeInterceptor jwtHandshakeInterceptor, StompSecurityInterceptor stompSecurityInterceptor, InboundSizeAndRateInterceptor inboundSizeAndRateInterceptor, OutboundFloodGuardInterceptor outboundFloodGuardInterceptor, SessionRegistry sessionRegistry, @Lazy PendingMessageService pendingMessages) {        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.stompSecurityInterceptor = stompSecurityInterceptor;
        this.inboundSizeAndRateInterceptor = inboundSizeAndRateInterceptor;
        this.outboundFloodGuardInterceptor = outboundFloodGuardInterceptor;
        this.sessionRegistry = sessionRegistry;
        this.pendingMessages = pendingMessages;
    }

    @Value("${cors.allowed-origins:*}")
    private String[] allowedOrigins;
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("*")            // tighten in prod
                .addInterceptors(jwtHandshakeInterceptor);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Security/ACLs first, then size/rate guard
        registration.interceptors(stompSecurityInterceptor, inboundSizeAndRateInterceptor);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        // Backpressure guard on outbound
        registration.interceptors(outboundFloodGuardInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration reg) {
        // Transport-level caps
        reg.setMessageSizeLimit(64 * 1024);      // 64KB per inbound STOMP frame
        reg.setSendBufferSizeLimit(512 * 1024);  // 512KB per-session send buffer
        reg.setSendTimeLimit(10_000);            // 10s per send

        // Track opens/closes for duplicate-login policy & server-side kick
        reg.addDecoratorFactory(new WebSocketHandlerDecoratorFactory() {
            @Override
            public WebSocketHandler decorate(WebSocketHandler handler) {
                return new WebSocketHandlerDecorator(handler) {
                    @Override
                    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                        Long uid = (Long) session.getAttributes().get("userId");
                        if (uid != null) {
                            sessionRegistry.onOpen(uid, session);
                            pendingMessages.flush(uid);
                        }
                        super.afterConnectionEstablished(session);
                    }
                    @Override
                    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                        Long uid = (Long) session.getAttributes().get("userId");
                        sessionRegistry.onClose(session, uid);
                        super.afterConnectionClosed(session, status);
                    }
                };
            }
        });
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
//        config.enableStompBrokerRelay("/topic", "/queue", "/user") // RabbitMQ STOMP relay
//                .setRelayHost("localhost")
//                .setRelayPort(61613)
//                .setClientLogin("guest")
//                .setClientPasscode("guest");
        config.enableSimpleBroker("/topic", "/queue", "/user"); // in-memory broker for local testing
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }
}
