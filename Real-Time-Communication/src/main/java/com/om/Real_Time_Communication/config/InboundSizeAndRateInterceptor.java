package com.om.Real_Time_Communication.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;

/** Caps inbound payload size and applies simple sliding-window rate limits. */
@Component
@RequiredArgsConstructor
public class InboundSizeAndRateInterceptor implements ChannelInterceptor {
    private static final int CONNECT_MAX_BYTES = 256 * 1024; // allow fatter CONNECT headers (Authorization + E2EE)
    private static final int DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64KB cap for regular traffic

    @Value("${rtc.rate-limit.enabled:true}")
    private boolean rateLimitingEnabled;

    @Value("${rtc.rate-limit.subscriptions-per-window:25}")
    private int subscriptionsPerWindow;

    @Value("${rtc.rate-limit.subscription-window-ms:10000}")
    private long subscriptionWindowMs;


    @Autowired
    private  SlidingWindowRateLimiter limiter;

    @Override
    public Message<?> preSend(Message<?> msg, MessageChannel ch) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(msg);
        if (acc == null || acc.getCommand() == null) return msg;

        // 1) Size cap
        Object payload = msg.getPayload();
        int size = 0;
        if (payload instanceof byte[]) size = ((byte[]) payload).length;
        else if (payload instanceof String) size = ((String) payload).getBytes(StandardCharsets.UTF_8).length;
        int maxBytes = StompCommand.CONNECT.equals(acc.getCommand()) ? CONNECT_MAX_BYTES : DEFAULT_MAX_PAYLOAD_BYTES;
        if (size > maxBytes) {
            throw new IllegalArgumentException("Payload too large: " + size + " bytes");
        }

        if (!rateLimitingEnabled) {
            return msg;
        }
        // 2) Rate limits
        String user = acc.getUser() != null ? acc.getUser().getName() : "anon";
        StompCommand cmd = acc.getCommand();

        if (StompCommand.CONNECT.equals(cmd)) {
            // Allow more generous burst during reconnect storms; key on IP when available, session otherwise.
            String connectKey = headerFirst(acc, "X-Forwarded-For");
            if (connectKey == null || connectKey.isBlank()) {
                connectKey = acc.getSessionId() != null ? acc.getSessionId() : "unknown";
            }
            limiter.checkOrThrow("conn:" + connectKey + ":connect", 30, 10_000);
        } else if (StompCommand.SUBSCRIBE.equals(cmd)) {
            // 10 joins / 10s per user
            limiter.checkOrThrow("u:" + user + ":joins",  subscriptionsPerWindow, subscriptionWindowMs);
        } else if (StompCommand.SEND.equals(cmd)) {
            // 50 msgs / 5s per (user, room) + 200 msgs / 5s global per user
            String dest = acc.getDestination();        // e.g., /app/room/123/send
            String roomId = parseRoomId(dest);
            limiter.checkOrThrow("u:" + user + ":r:" + roomId + ":send", 50, 5_000);
            limiter.checkOrThrow("u:" + user + ":send", 200, 5_000);
        }
        return msg;
    }

    private static String headerFirst(StompHeaderAccessor acc, String name) {
        List<String> v = acc.getNativeHeader(name);
        return (v == null || v.isEmpty()) ? null : v.get(0);
    }
    private static String parseRoomId(String dest) {
        if (dest == null) return "-1";
        String prefix = "/app/rooms/";
        if (dest.startsWith(prefix)) {
            int end = dest.indexOf('/', prefix.length());
            if (end > 0) {
                return dest.substring(prefix.length(), end);
            }
        }
        return "-1";
    }
}
