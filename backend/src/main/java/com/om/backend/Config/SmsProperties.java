package com.om.backend.Config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "sms")
public class SmsProperties {
    private String baseUrl;
    private String apiKey;
    private String clientId;
    private String senderId;
    private boolean externalSendingEnabled = false;

    private String numberFormat = "CC91";

    // NEW: body type the provider expects
    // values: "JSON" or "FORM"
    private String transport = "JSON";

    private Dlt dlt = new Dlt();
    private Otp otp = new Otp();
    private Test test = new Test();

    public String getNumberFormat() {
        return numberFormat;
    }

    public void setNumberFormat(String numberFormat) {
        this.numberFormat = numberFormat;
    }

    public String getTransport() {
        return transport;
    }

    public void setTransport(String transport) {
        this.transport = transport;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public Dlt getDlt() {
        return dlt;
    }

    public void setDlt(Dlt dlt) {
        this.dlt = dlt;
    }

    public Otp getOtp() {
        return otp;
    }

    public boolean isExternalSendingEnabled() {
        return externalSendingEnabled;
    }

    public void setExternalSendingEnabled(boolean externalSendingEnabled) {
        this.externalSendingEnabled = externalSendingEnabled;
    }
    public Test getTest() {
        return test;
    }

    public void setTest(Test test) {
        this.test = test;
    }


    @Data
    public static class Dlt {
        private String templateId;
        private String content; // DLT-approved content with {#var#} placeholders

        public String getTemplateId() {
            return templateId;
        }

        public String getContent() {
            return content;
        }

        public void setTemplateId(String templateId) {
            this.templateId = templateId;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }

    @Data
    public static class Otp {
        private int ttlMinutes = 10;

        public int getTtlMinutes() {
            return ttlMinutes;
        }

        public int getDigits() {
            return digits;
        }

        public int getPerMinuteLimit() {
            return perMinuteLimit;
        }

        public int getPerHourLimit() {
            return perHourLimit;
        }

        private int digits = 6;
        private int perMinuteLimit = 1;
        private int perHourLimit = 5;

        private boolean persistForAudit = false;

        // getters/setters...
        public boolean isPersistForAudit() { return persistForAudit; }
        public void setPersistForAudit(boolean persistForAudit) { this.persistForAudit = persistForAudit; }

        public void setTtlMinutes(int ttlMinutes) {
            this.ttlMinutes = ttlMinutes;
        }

        public void setDigits(int digits) {
            this.digits = digits;
        }

        public void setPerMinuteLimit(int perMinuteLimit) {
            this.perMinuteLimit = perMinuteLimit;
        }

        public void setPerHourLimit(int perHourLimit) {
            this.perHourLimit = perHourLimit;
        }


    }

    @Data
    public static class Test {
        private boolean enabled = false;
        private String phoneNumber;
        private List<String> additionalPhoneNumbers = new ArrayList<>();
        private String otpCode = "000000";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }

        public String getOtpCode() {
            return otpCode;
        }

        public void setOtpCode(String otpCode) {
            this.otpCode = otpCode;
        }

        public List<String> getAdditionalPhoneNumbers() {
            return additionalPhoneNumbers;
        }

        public void setAdditionalPhoneNumbers(List<String> additionalPhoneNumbers) {
            this.additionalPhoneNumbers = additionalPhoneNumbers;
        }
    }


}
