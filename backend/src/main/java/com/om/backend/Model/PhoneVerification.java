package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
public class PhoneVerification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Unique verification record ID

    private String phoneNumber; // Phone number being verified
    private boolean isVerified; // Verification status (true if verified)
    private LocalDateTime verifiedAt; // When the phone number was verified
    private LocalDateTime verificationRequestedAt; // When the OTP was sent for verification

    @OneToOne(mappedBy = "phoneVerification")
    private User user; // Link back to the User entity

    @PrePersist
    public void setVerificationRequestedAt() {
        this.verificationRequestedAt = LocalDateTime.now(); // Timestamp when verification is requested
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public boolean isVerified() {
        return isVerified;
    }

    public void setVerified(boolean verified) {
        isVerified = verified;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(LocalDateTime verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public LocalDateTime getVerificationRequestedAt() {
        return verificationRequestedAt;
    }

    public void setVerificationRequestedAt(LocalDateTime verificationRequestedAt) {
        this.verificationRequestedAt = verificationRequestedAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}

