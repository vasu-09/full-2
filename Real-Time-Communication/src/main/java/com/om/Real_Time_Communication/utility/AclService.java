package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import io.micrometer.common.lang.Nullable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class AclService {
//    private final StringRedisTemplate redis;
private final @Nullable StringRedisTemplate redis;
    private final ChatRoomParticipantRepository participantRepo;

//    public AclService(StringRedisTemplate redis) {
//        this.redis = redis;
//    }
public AclService(@Nullable StringRedisTemplate redis, ChatRoomParticipantRepository participantRepo) {
    this.redis = redis;
    this.participantRepo = participantRepo;
}

    public boolean canSubscribe(Long userId, Long roomId) {
//        Boolean ok = redis.opsForSet().isMember("room:members:"+roomId, String.valueOf(userId));
//        return Boolean.TRUE.equals(ok);
        if (redis != null) {
            Boolean ok = redis.opsForSet().isMember("room:members:" + roomId, String.valueOf(userId));
            if (Boolean.TRUE.equals(ok)) {
                return true;
            }
        }
        return participantRepo.existsByRoomIdAndUserId(roomId, userId);
    }

    public boolean canPublish(Long userId, Long roomId) {
        // same as subscribe or stricter if you have roles (owners/mods)
        return canSubscribe(userId, roomId);
    }
    // bump version on membership change
    public void onMembershipChanged(Long roomId) {

//    redis.opsForValue().increment("room:v:"+roomId);
        if (redis != null) {
            redis.opsForValue().increment("room:v:" + roomId);
        }
    }
}
