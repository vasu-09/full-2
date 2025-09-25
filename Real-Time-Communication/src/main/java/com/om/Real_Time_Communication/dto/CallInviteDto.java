package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.CallType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class CallInviteDto {
    private java.util.List<Long> calleeIds;
    public java.util.List<Long> getCalleeIds(){return calleeIds;}
    public void setCalleeIds(java.util.List<Long> v){calleeIds=v;} }
