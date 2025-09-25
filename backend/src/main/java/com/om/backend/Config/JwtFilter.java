package com.om.backend.Config;


import com.om.backend.services.JWTService;

import com.om.backend.services.OtpService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {

    @Autowired
    private JWTService jwtService;

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);


    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String token = null;
        String sub = null; // holds the JWT subject (user id)

        log.info("autorization token: authorizatio={}", authHeader);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
            sub = jwtService.extractPhonenumber(token); // subject = userId

        }
        // Previously we loaded the user by phone number. However our tokens use the
        // user id as the subject, which caused lookups to fail and every request to
        // be rejected with 403. Instead, simply trust the verified JWT claims and
        // authenticate with the user id extracted from the token.
        if (sub != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            // ensure token is valid (signature + not expired)
            if (!jwtService.isTokenExpired(token)) {
                UsernamePasswordAuthenticationToken authentoken =
                        new UsernamePasswordAuthenticationToken(sub, token, List.of());
                authentoken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentoken);
            }
        }
        filterChain.doFilter(request, response);
    }
}
