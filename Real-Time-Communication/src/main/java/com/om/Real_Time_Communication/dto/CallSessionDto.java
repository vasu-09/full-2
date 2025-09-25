package com.om.Real_Time_Communication.dto;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CallSessionDto {
    private Long id;
    private Long roomId;
    private Long initiatorId;
    private java.util.List<Long> calleeIds;  // derived from CSV
    private String state;                    // CallState as string
    private java.time.Instant createdAt;
    private java.time.Instant ringingAt;
    private java.time.Instant answeredAt;
    private java.time.Instant endedAt;
    private Long durationSeconds;            // derived
    private String topology;

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

    public List<Long> getCalleeIds() {
        return calleeIds;
    }

    public void setCalleeIds(List<Long> calleeIds) {
        this.calleeIds = calleeIds;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
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

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public String getTopology() {
        return topology;
    }

    public void setTopology(String topology) {
        this.topology = topology;
    }
}
