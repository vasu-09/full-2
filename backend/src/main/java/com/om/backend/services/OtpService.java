
/**
 * Handles OTP send/verify and mints JWTs by delegating to a JwtSigner bean.
 * Make sure your JwtSigner sets the 'sid' claim to the sessionId you pass in.
 */
package com.om.backend.services;

import com.om.backend.Config.SmsProperties;
//import com.om.backend.Dto.SendSmsRequest;
import com.om.backend.Dto.SendSmsResponse;
import com.om.backend.Model.User;
import com.om.backend.Model.Otp;

import com.om.backend.Repositories.OtpRepository;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.util.OtpMessageBuilder;
import com.om.backend.util.PhoneNumberUtil1;          // your util with toE164India(...)


import com.om.backend.util.SmsClient;
//import org.apache.commons.lang.RandomStringUtils;
//import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;


import java.util.Optional;
//new code
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * OTP service backed by Redis for OTP storage & rate limiting, and your SMS provider for delivery.
 * Persists users in DB; (optional) can persist OTP rows for audit.
 */
@Service
public class OtpService {

    // ===== Injected deps (from your old class) =====
//    private final StringRedisTemplate redis;
    private final SmsProperties props;
    private final SmsClient smsClient;
    private final OtpMessageBuilder messageBuilder;

    // ===== Existing deps from the "new" design =====
    private final OtpRepository otpRepo;      // optional (audit); keep if you want
    private final UserRepository userRepo;
    private final JwtSigner jwtSigner;
    private final Clock clock;

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

//    public OtpService(StringRedisTemplate redis, SmsProperties props, SmsClient smsClient, OtpMessageBuilder messageBuilder, OtpRepository otpRepo, UserRepository userRepo, JwtSigner jwtSigner, Clock clock) {
//        this.redis = redis;
// In‑memory stores
    private final ConcurrentMap<String, String> otpStore = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Instant> otpExpiry = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> minuteCounts = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Instant> minuteExpiry = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> hourCounts = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Instant> hourExpiry = new ConcurrentHashMap<>();

    public OtpService(SmsProperties props,
                      SmsClient smsClient,
                      OtpMessageBuilder messageBuilder,
                      OtpRepository otpRepo,
                      UserRepository userRepo,
                      JwtSigner jwtSigner,
                      Clock clock) {
        this.props = props;
        this.smsClient = smsClient;
        this.messageBuilder = messageBuilder;
        this.otpRepo = otpRepo;
        this.userRepo = userRepo;
        this.jwtSigner = jwtSigner;
        this.clock = clock;
    }

// ===================== SEND OTP =====================

    /**
     * Step 1: generate & send OTP via SMS (Redis + rate limits).
     */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void sendOtp(String rawPhone) {




        String e164 = PhoneNumberUtil1.toE164India(rawPhone); // choose the outgoing number per config
//        String phone = "NSN10".equalsIgnoreCase(props.getNumberFormat()) ? PhoneNumberUtil1.toIndiaNsn10(rawPhone) // 9876543210
//         : PhoneNumberUtil1.toIndia91NoPlus(rawPhone); // 919876543210 (default in yml)

        String phone = normalizePhoneNumber(rawPhone);

        if (isTestMode() && !isTestNumber(phone)) {
            throw new IllegalArgumentException("Test mode allows OTP only for the configured test phone number");
        }


        // 1) rate-limit (Redis counters)
        enforceRateLimits(phone);

//        System.out.print(phone);
//
//        // 2) generate OTP using your config
//        int digits = props.getOtp().getDigits();
//        String otp = generateNumericOtp(digits);
        String otp;
        if (isTestNumber(phone)) {
            otp = resolveTestOtp();
        } else {
            int digits = props.getOtp().getDigits();
            otp = generateNumericOtp(digits);
        }

        // 3) store OTP in Redis with TTL (overwrite any existing)
        Duration ttl = Duration.ofMinutes(props.getOtp().getTtlMinutes());
//        redis.opsForValue().set(otpKey(phone), otp, ttl);
        otpStore.put(phone, otp);
        otpExpiry.put(phone, Instant.now(clock).plus(ttl));

        // 4) (optional) also persist to DB for audit/troubleshooting (comment out if not needed)

            Otp row = otpRepo.findByPhoneNumber(phone).orElseGet(Otp::new);
            row.setPhoneNumber(phone);
            row.setOtpCode(otp);
            row.setExpiredAt(Instant.now(clock).plus(ttl));
            otpRepo.save(row);

        if (isTestNumber(phone)) {
            log.info("Test mode enabled - skipping SMS send for configured test phone");
            return;
        }
        // Send via your SMS provider
        SendSmsResponse res = smsClient.sendOtpMessage(messageBuilder.build(otp), phone, true);
//        log.info("OTP send: e164={}, providerMobile={}", rawPhone, phone);
        log.info("OTP send: e164={}, providerMobile={}", e164, phone);
        if (res == null || !res.isOk()) {
            String desc = res != null && res.getErrorDescription() != null ? res.getErrorDescription() : "unknown";
            Integer code = res != null ? res.getErrorCode() : null;
            throw new RuntimeException("SMS send failed: " + desc + (code != null ? " (code " + code + ")" : ""));
        }

    }


    // ===================== VERIFY OTP =====================

    /**
     * Step 2: verify OTP from Redis; delete on success; return userId (create user if needed).
     * This replaces the previous DB-only verification.
     */
    @Transactional
    public Long verifyOtp(String rawPhone, String otpCode) {
//        String phone = "NSN10".equalsIgnoreCase(props.getNumberFormat())
//                ? PhoneNumberUtil1.toIndiaNsn10(rawPhone)
//                : PhoneNumberUtil1.toIndia91NoPlus(rawPhone);
        String phone = normalizePhoneNumber(rawPhone);

        if (isTestMode() && !isTestNumber(phone)) {
            throw new IllegalArgumentException("Test mode allows OTP only for the configured test phone number");
        }

        // 1) fetch OTP from Redis
//        String key = otpKey(phone);
//        String expected = redis.opsForValue().get(key);
//        if (expected != null) {
            // Redis path (preferred)

        String expected = otpStore.get(phone);
        Instant exp = otpExpiry.get(phone);
        Instant now = Instant.now(clock);
        if (expected != null && exp != null && now.isBefore(exp)) {
            if (!otpCode.equals(expected)) {
                throw new IllegalArgumentException("Invalid OTP");
            }
            // delete OTP (single-use)
//            redis.delete(key);
            otpStore.remove(phone);
            otpExpiry.remove(phone);
        } else {
            // Optional DB fallback when auditing is enabled
            Optional<Otp> audit = otpRepo.findByPhoneNumber(phone);
//            if (audit.isEmpty() || Instant.now(clock).isAfter(audit.get().getExpiredAt())) {
            if (audit.isEmpty() || now.isAfter(audit.get().getExpiredAt())) {
                throw new IllegalArgumentException("OTP expired or not requested");
            }
            if (!otpCode.equals(audit.get().getOtpCode())) {
                throw new IllegalArgumentException("Invalid OTP");
            }
            // clear audit row if you want true single-use semantics
            otpRepo.delete(audit.get());
        }

        // 2) resolve/create user
        return userRepo.findByPhoneNumber(phone)
                .map(User::getId)
                .orElseGet(() -> {
                    User u = new User();
                    u.setPhoneNumber(phone);
                    u.setCreatedAt(Instant.now(clock));
                    u.setUpdatedAt(Instant.now(clock));
                    userRepo.save(u);
                    return u.getId();
                });
    }

    // ===================== TOKEN MINTING =====================

    /**
     * Mint a short-lived access token (must include 'sid' = sessionId).
     */
    public String mintAccessToken(Long userId, String sessionId) {
        return jwtSigner.signAccessToken(userId, sessionId);
    }

    /**
     * Mint a long-lived refresh token (recommended to include 'sid' = sessionId).
     */
    public String mintRefreshToken(Long userId, String sessionId) {
        return jwtSigner.signRefreshToken(userId, sessionId);
    }

    // ===================== HELPERS =====================

//    private String otpKey(String phone) {
//        // dedicated namespace in Redis
//        return "otp:" + phone;
//    }
//
//    private String rlMinuteKey(String phone) {
//        return "otp:rl:minute:" + phone;
//    }
//
//    private String rlHourlyKey(String phone) {
//        return "otp:rl:hour:" + phone;
//    }

    /**
     * Basic dual-window rate limiting:
     * - per-minute: e.g., 1–3 sends
     * - per-day:    e.g., 5–10 sends
     * These thresholds come from SmsProperties.
     */
    private void enforceRateLimits(String phone) {
        int perMinute = props.getOtp().getPerMinuteLimit();
        int perHour = props.getOtp().getPerHourLimit();
        Instant now = Instant.now(clock);

        // minute window (60s)
//        Long minuteCount = redis.opsForValue().increment(rlMinuteKey(phone));
//        if (minuteCount != null && minuteCount == 1L) {
//            redis.expire(rlMinuteKey(phone), 60, TimeUnit.SECONDS);
//        }
//        if (minuteCount != null && minuteCount > perMinute) {
        minuteExpiry.compute(phone, (k, exp) -> {
            if (exp == null || now.isAfter(exp)) {
                minuteCounts.put(k, 0L);
                return now.plusSeconds(60);
            }
            return exp;
        });
        long minute = minuteCounts.merge(phone, 1L, Long::sum);
        if (minute > perMinute) {
            throw new IllegalStateException("Too many OTP requests. Try again later.");
        }

        // daily window (24h)
//        Long hourCount = redis.opsForValue().increment(rlHourlyKey(phone));
//        if (hourCount != null && hourCount > perHour) {
//            throw new IllegalStateException("Too many OTP requests. Try again later.");
//        }
//        if (hourCount != null && hourCount > perHour) {
//                throw new IllegalStateException("Too many OTP requests. Try again later.");

        hourExpiry.compute(phone, (k, exp) -> {
            if (exp == null || now.isAfter(exp)) {
                hourCounts.put(k, 0L);
                return now.plusSeconds(3600);
            }
            return exp;
        });
        long hour = hourCounts.merge(phone, 1L, Long::sum);
        if (hour > perHour) {
            throw new IllegalStateException("Too many OTP requests. Try again later.");
        }
    }

    private String normalizePhoneNumber(String rawPhone) {
        return "NSN10".equalsIgnoreCase(props.getNumberFormat())
                ? PhoneNumberUtil1.toIndiaNsn10(rawPhone)
                : PhoneNumberUtil1.toIndia91NoPlus(rawPhone);
    }

    private boolean isTestMode() {
        return props.getTest() != null && props.getTest().isEnabled();
    }

    private boolean isTestNumber(String normalizedPhone) {
        if (!isTestMode()) {
            return false;
        }
        String configured = props.getTest().getPhoneNumber();
        if (!StringUtils.hasText(configured)) {
            return false;
        }
        return normalizedPhone.equals(normalizePhoneNumber(configured));
    }

    private String resolveTestOtp() {
        String otp = props.getTest().getOtpCode();
        if (!StringUtils.hasText(otp)) {
            otp = "000000";
        }
        return otp;
    }

    private String generateNumericOtp(int digits) {
        if (digits <= 0) {
            throw new IllegalArgumentException("OTP length must be positive");
        }
        StringBuilder builder = new StringBuilder(digits);
        for (int i = 0; i < digits; i++) {
            builder.append(RANDOM.nextInt(10));
        }
        return builder.toString();
    }

        /** Minimal signer abstraction expected to be provided elsewhere in your app. */


    public interface JwtSigner {
        String signAccessToken(Long userId, String sessionId);

        String signRefreshToken(Long userId, String sessionId);
    }
}

