package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.CallSession;
import com.om.Real_Time_Communication.models.CallState;
import org.springframework.stereotype.Component;

@Component
public class CallDtoMapper {

    public CallSessionDto toDto(CallSession s) {
        CallSessionDto d = new CallSessionDto();
        d.setId(s.getId());
        d.setRoomId(s.getRoomId());
        d.setInitiatorId(s.getInitiatorId());
        d.setCalleeIds(parseCsvIds(s.getCalleeIdsCsv()));
        d.setState(s.getState().name());
        d.setCreatedAt(s.getCreatedAt());
        d.setRingingAt(s.getRingingAt());
        d.setAnsweredAt(s.getAnsweredAt());
        d.setEndedAt(s.getEndedAt());
        d.setTopology(s.getTopology());

        if (s.getAnsweredAt() != null && s.getEndedAt() != null) {
            d.setDurationSeconds(java.time.Duration.between(s.getAnsweredAt(), s.getEndedAt()).getSeconds());
        } else {
            d.setDurationSeconds(null);
        }
        return d;
    }

    public void updateEntityFromDto(CallSessionDto d, CallSession s) {
        if (d.getRoomId() != null) s.setRoomId(d.getRoomId());
        if (d.getInitiatorId() != null) s.setInitiatorId(d.getInitiatorId());
        if (d.getCalleeIds() != null) s.setCalleeIdsCsv(joinCsvIds(d.getCalleeIds()));
        if (d.getState() != null) s.setState(CallState.valueOf(d.getState()));
        if (d.getCreatedAt() != null) s.setCreatedAt(d.getCreatedAt());
        if (d.getRingingAt() != null) s.setRingingAt(d.getRingingAt());
        if (d.getAnsweredAt() != null) s.setAnsweredAt(d.getAnsweredAt());
        if (d.getEndedAt() != null) s.setEndedAt(d.getEndedAt());
        if (d.getTopology() != null) s.setTopology(d.getTopology());
    }

    private static java.util.List<Long> parseCsvIds(String csv) {
        if (csv == null || csv.isBlank()) return java.util.List.of();
        java.util.List<Long> out = new java.util.ArrayList<>();
        for (String p : csv.split(",")) {
            String t = p.trim();
            if (!t.isEmpty()) out.add(Long.parseLong(t));
        }
        return out;
    }

    private static String joinCsvIds(java.util.List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i=0;i<ids.size();i++) {
            if (i>0) sb.append(',');
            sb.append(ids.get(i));
        }
        return sb.toString();
    }
}
