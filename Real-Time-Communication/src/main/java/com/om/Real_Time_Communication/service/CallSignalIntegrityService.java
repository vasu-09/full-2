package com.om.Real_Time_Communication.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory buffer to ensure ICE candidates are not lost
 * if a peer has not yet joined a call. Candidates are stored per
 * call and per user until the target user joins, at which point
 * they are delivered and removed.
 */
@Service
public class CallSignalIntegrityService {

    /** callId -> (userId -> pending candidates) */
    private final Map<Long, Map<Long, List<PendingCandidate>>> pending = new ConcurrentHashMap<>();
    /** callId -> joined user ids */
    private final Map<Long, Set<Long>> joined = new ConcurrentHashMap<>();

    /** Mark that a user has joined a call. */
    public List<PendingCandidate> markJoined(Long callId, Long userId) {
        joined.computeIfAbsent(callId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        // Return and remove any pending candidates for this user
        Map<Long, List<PendingCandidate>> perUser = pending.get(callId);
        if (perUser == null) {
            return List.of();
        }
        List<PendingCandidate> list = perUser.remove(userId);
        if (perUser.isEmpty()) {
            pending.remove(callId);
        }
        return list == null ? List.of() : list;
    }

    /**
     * Buffer a candidate for all peers in the call who have not yet joined.
     * @param callId call identifier
     * @param fromUser sender user id
     * @param candidate candidate string
     * @param participants all participants in the call (including sender)
     */
    public void bufferCandidate(Long callId, Long fromUser, String candidate, List<Long> participants) {
        Set<Long> joinedSet = joined.computeIfAbsent(callId, k -> ConcurrentHashMap.newKeySet());
        for (Long peer : participants) {
            if (peer.equals(fromUser)) {
                continue;
            }
            if (joinedSet.contains(peer)) {
                continue; // already joined, delivery handled via STOMP topic
            }
            pending
                    .computeIfAbsent(callId, k -> new ConcurrentHashMap<>())
                    .computeIfAbsent(peer, k -> new ArrayList<>())
                    .add(new PendingCandidate(fromUser, candidate));
        }
    }

    /**
     * Simple holder for a pending candidate message.
     */
    public static class PendingCandidate {
        public final Long from;
        public final String candidate;
        public PendingCandidate(Long from, String candidate) {
            this.from = from;
            this.candidate = candidate;
        }
    }
}
