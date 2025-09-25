package com.om.Real_Time_Communication.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.service.BlockService;
import com.om.Real_Time_Communication.utility.AclService;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

/**
 * Validates JWT in STOMP CONNECT (if handshake didn’t set a Principal),
 * and authorizes SUBSCRIBE / SEND per destination.
 */
@Component
@RequiredArgsConstructor
public class StompSecurityInterceptor implements ChannelInterceptor {

    // If your API-Gateway signs an internal header instead of passing Authorization,
    // verify that here instead. For simplicity we reuse the same secret as the handshake.
    private static final String SECRET = "f93c9b55c8d00c302bc7aee3c87b707cb96b0465d64ac3bc85955d4396e1e3de";

    @Autowired
    private  BlockService blockService;

    @Autowired
    private   AclService acl;

    @Autowired
    private  ChatRoomParticipantRepository participantRepo;

    @Autowired
    private ChatRoomRepository chatRoomRepository;


    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        MDC.clear();
    }
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(message);
        StompCommand cmd = acc.getCommand();
        if (cmd == null) return message;

        // MDC/correlation as you already added…
        try {
            Long userId = acc.getUser() != null ? Long.valueOf(acc.getUser().getName()) : null;

            switch (cmd) {
                case SUBSCRIBE: {
                    requireUser(acc); // throws if null
                    String dest = acc.getDestination(); // /topic/room/{roomId}
                    if (dest != null && dest.startsWith("/topic/room/")) {
                        String roomKey = dest.substring("/topic/room/".length()).split("/")[0];
                        Long roomId = chatRoomRepository.findByRoomId(roomKey)
                                .map(ChatRoom::getId)
                                .orElseThrow(() -> new IllegalArgumentException("Unknown room " + roomKey));

                        // 1) Room ACL (Redis-backed)
                        if (!acl.canSubscribe(userId, roomId)) {
                            throw new IllegalArgumentException("Forbidden: not a member of room " + roomId);
                        }

                        // 2) Block check (receiver-side): if any member blocks this user, deny subscribe for DM/1:1
                        // For group rooms, you might only enforce peer block on direct @mentions or DMs; adjust policy.
                        if (isDirectRoom(roomId)) {
                            Long other = directPeer(roomId, userId);
                            if (blockService.isBlocked(String.valueOf(userId), String.valueOf(other))) {
                                throw new IllegalArgumentException("Forbidden: you are blocked");
                            }
                        }
                    }
                    break;
                }
                case SEND: {
                    requireUser(acc);
                    String dest = acc.getDestination(); // /topic/room/{roomId}
                    if (dest != null && dest.startsWith("/topic/room/")) {
                        String roomKey = dest.substring("/topic/room/".length()).split("/")[0];
                        Long roomId = chatRoomRepository.findByRoomId(roomKey)
                                .map(ChatRoom::getId)
                                .orElseThrow(() -> new IllegalArgumentException("Unknown room " + roomKey));

                        // 1) Room ACL
                        if (!acl.canPublish(userId, roomId)) {
                            throw new IllegalArgumentException("Forbidden: cannot publish to room " + roomId);
                        }

                        // 2) Block check (sender-side): for DMs, or for group if you enforce peer blocks globally
                        if (isDirectRoom(roomId)) {
                            Long other = directPeer(roomId, userId);
                            if (blockService.isBlocked(String.valueOf(userId), String.valueOf(other))) {
                                throw new IllegalArgumentException("Forbidden: user has blocked you");
                            }
                        }
                    }
                    break;
                }
                default: /* no-op */
            }
            return message;
        } finally {
            // MDC clear in afterSendCompletion()
        }
    }

    private boolean isDirectRoom(Long roomId) {
        return participantRepo.countByRoomId(roomId) == 2L;
    }

    /** Return the other user in a 1:1 room (throws if not exactly two). */
    private Long directPeer(Long roomId, Long userId) {
        java.util.List<Long> users = participantRepo.findUserIdsByRoomId(roomId);
        if (users.size() != 2) throw new IllegalArgumentException("Not a direct room: " + roomId);
        return users.get(0).equals(userId) ? users.get(1) : users.get(0);
    }
    private static String headerFirst(StompHeaderAccessor acc, String name) {
        List<String> v = acc.getNativeHeader(name);
        return (v == null || v.isEmpty()) ? null : v.get(0);
    }

    private static Long requireUser(StompHeaderAccessor acc) {
        Principal p = acc.getUser();
        if (p == null) throw new IllegalArgumentException("No Principal on frame");
        return Long.valueOf(p.getName());
    }

    private static Long parseUserId(String bearerOrToken) {
        String token = bearerOrToken.startsWith("Bearer ") ? bearerOrToken.substring(7) : bearerOrToken;
        var verifier = JWT.require(Algorithm.HMAC256(SECRET)).build();
        var jwt = verifier.verify(token);
        // subject or claim—match what you issue in your auth service
        String sub = jwt.getSubject();
        if (sub == null) throw new IllegalArgumentException("Token has no subject");
        return Long.valueOf(sub);
    }

    /**
     * Minimal Principal that carries userId as name for STOMP APIs.
     */
    static final class WsUserPrincipal implements Principal {
        private final Long userId;
        WsUserPrincipal(Long userId) { this.userId = userId; }
        @Override public String getName() { return String.valueOf(userId); }
        public Long getUserId() { return userId; }
    }

    /**
     * Replace this with your real ACL service (DB/Redis).
     */
    static final class Acl {
        static boolean canSubscribe(Long userId, String roomId) { return true; }
        static boolean canPublish(Long userId, String roomId) { return true; }
    }
}

