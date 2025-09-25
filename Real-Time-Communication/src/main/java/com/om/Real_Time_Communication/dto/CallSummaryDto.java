package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.CallState;

import java.time.Instant;
import java.util.List;

public class CallSummaryDto {
    private Long callId;
    private Long roomId;
    private Long initiatorId;
    private List<Long> participants; // initiator + callees
    private CallState state;
    private String topology;        // P2P/SFU
    private Instant createdAt;
    private Instant answeredAt;
    private Instant endedAt;
    private long durationSec;       // 0 if not ended
    private boolean missed;         // unanswered (TIMEOUT/DECLINED with no ANSWERED)

    public CallSummaryDto() {}

    public CallSummaryDto(Long callId, Long roomId, Long initiatorId, List<Long> participants,
                          CallState state, String topology, Instant createdAt,
                          Instant answeredAt, Instant endedAt) {
        this.callId = callId;
        this.roomId = roomId;
        this.initiatorId = initiatorId;
        this.participants = participants;
        this.state = state;
        this.topology = topology;
        this.createdAt = createdAt;
        this.answeredAt = answeredAt;
        this.endedAt = endedAt;
        this.durationSec = (endedAt != null && createdAt != null)
                ? Math.max(0, endedAt.getEpochSecond() - createdAt.getEpochSecond()) : 0;
        this.missed = (answeredAt == null) && (state == CallState.TIMEOUT || state == CallState.DECLINED);
    }

    // getters/setters omitted for brevity
}
