package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "call_sessions")
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class CallSession {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private Long roomId;          // chat room or call room
    @Column(nullable=false) private Long initiatorId;     // caller
    @Column(nullable=false) private String calleeIdsCsv;  // "12,34,56" (1:1 or group)
    @Enumerated(EnumType.STRING) @Column(nullable=false)
    private CallState state;
    @Column(nullable=false) private Instant createdAt = Instant.now();
    private Instant ringingAt;
    private Instant answeredAt;
    private Instant endedAt;
    private long duration;
    @Column(nullable=false) private String topology;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getRoomId() {
        return roomId;
    }

    public void setRoomId(Long roomId) {
        this.roomId = roomId;
    }

    public Long getInitiatorId() {
        return initiatorId;
    }

    public void setInitiatorId(Long initiatorId) {
        this.initiatorId = initiatorId;
    }

    public String getCalleeIdsCsv() {
        return calleeIdsCsv;
    }

    public void setCalleeIdsCsv(String calleeIdsCsv) {
        this.calleeIdsCsv = calleeIdsCsv;
    }

    public CallState getState() {
        return state;
    }

    public void setState(CallState state) {
        this.state = state;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getRingingAt() {
        return ringingAt;
    }

    public void setRingingAt(Instant ringingAt) {
        this.ringingAt = ringingAt;
    }

    public Instant getAnsweredAt() {
        return answeredAt;
    }

    public void setAnsweredAt(Instant answeredAt) {
        this.answeredAt = answeredAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public long getDuration() {
        return duration;
    }

    public void setDuration(long duration) {
        this.duration = duration;
    }

    public String getTopology() {
        return topology;
    }

    public void setTopology(String topology) {
        this.topology = topology;
    }
}