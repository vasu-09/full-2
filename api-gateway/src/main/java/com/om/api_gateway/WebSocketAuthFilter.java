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

/**
 * Extracts a bearer token from the {@code Sec-WebSocket-Protocol} header and forwards it
 * as a normal {@code Authorization: Bearer <token>} header. The custom subprotocol value
 * is removed so that only genuine WebSocket subprotocols (e.g. STOMP versions) remain.
 */
@Component
public class WebSocketAuthFilter implements GlobalFilter, Ordered {

    private static final String WS_PROTOCOL_HEADER = "Sec-WebSocket-Protocol";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        if (!"websocket".equalsIgnoreCase(request.getHeaders().getUpgrade())) {
            return chain.filter(exchange);
        }

        List<String> protocols = new ArrayList<>();
        for (String header : request.getHeaders().getOrEmpty(WS_PROTOCOL_HEADER)) {
            for (String part : header.split(",")) {
                protocols.add(part.trim());
            }
        }

        String token = null;
        List<String> remaining = new ArrayList<>();
        for (int i = 0; i < protocols.size(); i++) {
            String p = protocols.get(i);
            if (p.regionMatches(true, 0, "bearer ", 0, 7)) {
                token = p.substring(7).trim();
            } else if (p.equalsIgnoreCase("bearer") && i + 1 < protocols.size()) {
                token = protocols.get(++i);
            } else {
                remaining.add(p);
            }
        }

        ServerHttpRequest.Builder mutated = request.mutate();
        if (token != null && !request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
            mutated.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        if (remaining.isEmpty()) {
            mutated.headers(h -> h.remove(WS_PROTOCOL_HEADER));
        } else {
            mutated.headers(h -> h.set(WS_PROTOCOL_HEADER, String.join(",", remaining)));
        }
        return chain.filter(exchange.mutate().request(mutated.build()).build());
    }

    @Override
    public int getOrder() {
        // run before JwtAuthFilter (-1) so that the Authorization header is available
        return -3;
    }
}