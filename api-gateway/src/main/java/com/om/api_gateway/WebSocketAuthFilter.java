package com.om.api_gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * Extracts a bearer token from the {@code Sec-WebSocket-Protocol} header and forwards it
 * as a normal {@code Authorization: Bearer <token>} header. The custom subprotocol value
 * is removed so that only genuine WebSocket subprotocols (e.g. STOMP versions) remain.
 */
@Component
public class WebSocketAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(WebSocketAuthFilter.class);

    private static final String WS_PROTOCOL_HEADER = "Sec-WebSocket-Protocol";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        boolean isWebSocketUpgrade = "websocket".equalsIgnoreCase(request.getHeaders().getUpgrade());
        boolean isWebSocketPath = request.getURI().getPath() != null &&
                (request.getURI().getPath().startsWith("/ws") || request.getURI().getPath().startsWith("/rtc/ws"));

        // Some clients (or intermediaries) drop/omit the Upgrade header on the first
        // hop. If we only looked at the header we would skip adding the Authorization
        // header when the client supplies the token as a query param or websocket
        // subprotocol. Treat known websocket paths as websocket intents so the token
        // is still promoted to the Authorization header.
        if (!isWebSocketUpgrade && !isWebSocketPath) {
            return chain.filter(exchange);
        }

        List<String> protocols = new ArrayList<>();
        if (isWebSocketUpgrade) {
            for (String header : request.getHeaders().getOrEmpty(WS_PROTOCOL_HEADER)) {
                for (String part : header.split(",")) {
                    protocols.add(part.trim());
                }
            }
        }

        log.info("[GATEWAY][WS-FILTER] Sec-WebSocket-Protocol raw="
                + request.getHeaders().getFirst(WS_PROTOCOL_HEADER));

        String token = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (token != null && token.regionMatches(true, 0, "bearer ", 0, 7)) {
            token = token.substring(7).trim();
        }
        List<String> remaining = new ArrayList<>();
        for (int i = 0; i < protocols.size(); i++) {
            String p = protocols.get(i);
            if (p.regionMatches(true, 0, "bearer ", 0, 7)) {
                token = p.substring(7).trim();
                log.info("[GATEWAY][WS-FILTER] Found bearer token in subprotocol (single): " + token);
            } else if (p.equalsIgnoreCase("bearer") && i + 1 < protocols.size()) {
                token = protocols.get(++i);
                log.info("[GATEWAY][WS-FILTER] Found bearer token in subprotocol (pair): " + token);
            } else {
                remaining.add(p);
            }
        }

        if (token == null || token.isBlank()) {
            token = request.getQueryParams().getFirst("access_token");
            log.info("[GATEWAY][WS-FILTER] Found token in access_token query param");
        }
        if (token == null || token.isBlank()) {
            token = request.getQueryParams().getFirst("token");
            log.info("[GATEWAY][WS-FILTER] Found token in token query param");
        }

        ServerHttpRequest.Builder mutated = request.mutate();
        if (token != null) {
            token = token.trim();
        }
        if (token != null && !token.isBlank()) {
            mutated.header(HttpHeaders.AUTHORIZATION, token.regionMatches(true, 0, "bearer ", 0, 7)
                    ? token
                    : "Bearer " + token);
        }
        if (isWebSocketUpgrade) {
            if (remaining.isEmpty()) {

                mutated.headers(h -> h.remove(WS_PROTOCOL_HEADER));
            } else {
                log.info("[GATEWAY][WS-FILTER] No token found for /ws request");
                mutated.headers(h -> h.set(WS_PROTOCOL_HEADER, String.join(",", remaining)));
            }
        }
        return chain.filter(exchange.mutate().request(mutated.build()).build());
    }

    @Override
    public int getOrder() {
        // run before JwtAuthFilter (-1) so that the Authorization header is available
        return -3;
    }
}