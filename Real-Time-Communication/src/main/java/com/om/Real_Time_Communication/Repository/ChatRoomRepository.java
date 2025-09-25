package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.ChatRoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    Optional<ChatRoom> findByRoomId(String roomId);

    @Query("SELECT r.name FROM ChatRoom r WHERE r.id = :roomId")
    String findNameByRoomId(@Param("roomId") String roomId);

    @Query("""
    select r
      from ChatRoom r
      join ChatRoomParticipant p1 on p1.chatRoom = r and p1.userId = :userA
      join ChatRoomParticipant p2 on p2.chatRoom = r and p2.userId = :userB
     where r.type = :type
  """)
    Optional<ChatRoom> findDirectRoom(
            @Param("userA") Long userA,
            @Param("userB") Long userB,
            @Param("type") ChatRoomType type
    );




}
