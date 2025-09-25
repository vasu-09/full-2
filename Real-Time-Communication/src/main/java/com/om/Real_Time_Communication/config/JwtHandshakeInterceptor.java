package com.om.Real_Time_Communication.config;

import com.om.Real_Time_Communication.security.JwtService;
import com.om.Real_Time_Communication.security.SessionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import org.springframework.web.socket.WebSocketHttpHeaders;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetSocketAddress;
import java.security.Principal;
import java.util.*;

/**
 * Authenticates the WebSocket handshake using a JWT and attaches a Principal & attributes
 * consumed by CustomHandshakeHandler and downstream STOMP security.
 *
 * Tokens are validated only during the initial handshake. Once a connection is
 * established the session remains trusted even if the JWT would expire; clients
 * must reconnect with a fresh token to re-authenticate.
 *
 * Supported token locations:
 *  - Authorization: Bearer <token>
 *  - Sec-WebSocket-Protocol: bearer,<token>
 *  - Query: ?access_token=<token> or ?token=<token>
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    private final JwtService jwtService;


    public JwtHandshakeInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;

    }

    @Override
    public boolean beforeHandshake(@NonNull ServerHttpRequest req,
                                   @NonNull ServerHttpResponse resp,
                                   @NonNull WebSocketHandler handler,
                                   @NonNull Map<String, Object> attrs) {
        try {
            final String token = extractBearerOrQueryToken(req);
            if (token == null) {
                setStatus(resp, HttpStatus.UNAUTHORIZED);
                return false;
            }

            // Validate & map claims → identity (userId, roles, tenant, etc.)
            JwtService.JwtIdentity id = jwtService.parse(token);

            var authorities = id.getRoles().stream()
                    .map(SimpleGrantedAuthority::new)
                    .collect(java.util.stream.Collectors.toSet());
            var auth = new UsernamePasswordAuthenticationToken(id.getUserId(), null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);

            // ---- OPTIONAL: single-session policy (uncomment if you want last-in-wins) ----
            // try { sessionRegistry.kickUser(id.getUserId(), "Replaced by new connection"); } catch (Exception ignore) {}

            // 1) Attach a Principal so STOMP sees accessor.getUser()
            Principal principal = new WsUserPrincipal(id.getUserId(), id.getRoles(), id.getTenant());
            attrs.put("principal", principal);

            // 2) Attach handy attributes other components expect
            attrs.put("userId", id.getUserId());
            attrs.put("roles", id.getRoles());
            attrs.put("tenant", id.getTenant());

            // 3) Diagnostics/context (keep if you use them)
            attrs.put("clientIp", clientIp(req));
            attrs.put("userAgent", req.getHeaders().getFirst(HttpHeaders.USER_AGENT));



            return true;

        } catch (Exception e) {
            log.warn("WS handshake auth failed: {}", e.getMessage());
            setStatus(resp, HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(@NonNull ServerHttpRequest request,
                               @NonNull ServerHttpResponse response,
                               @NonNull WebSocketHandler wsHandler,
                               Exception exception) {
        SecurityContextHolder.clearContext();
    }

    // ===== helpers =====

    private static void setStatus(ServerHttpResponse res, HttpStatus status) {
        try { res.setStatusCode(status); } catch (Exception ignore) {}
    }

    /** Extract token from Authorization, subprotocol, or query string. */
    private static String extractBearerOrQueryToken(ServerHttpRequest req) {
        // 1) Authorization: Bearer <token>
        String auth = req.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }

        // 3) Query: ?access_token=... or ?token=...
        if (req instanceof ServletServerHttpRequest sreq) {
            HttpServletRequest httpReq = sreq.getServletRequest();
            String t = Optional.ofNullable(httpReq.getParameter("access_token"))
                    .orElse(httpReq.getParameter("token"));
            if (t != null && !t.isBlank()) {
                return t.trim();
            }
        }
        return null;
    }

    private static String clientIp(ServerHttpRequest req) {
        String xff = req.getHeaders().getFirst("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return comma > 0 ? xff.substring(0, comma).trim() : xff.trim();
        }
        InetSocketAddress remote = req.getRemoteAddress();
        return remote != null && remote.getAddress() != null ? remote.getAddress().getHostAddress() : "unknown";
    }

    /** Principal used by CustomHandshakeHandler & STOMP accessors. */
    static final class WsUserPrincipal implements Principal {
        private final Long userId;
        private final Set<String> roles;
        private final String tenant;

        WsUserPrincipal(Long userId, Set<String> roles, String tenant) {
            this.userId = userId;
            this.roles = roles != null ? Collections.unmodifiableSet(new HashSet<>(roles)) : Collections.emptySet();
            this.tenant = tenant;
        }

        public Long getUserId() { return userId; }
        public Set<String> getRoles() { return roles; }
        public String getTenant() { return tenant; }

        @Override public String getName() { return String.valueOf(userId); }
    }
}
