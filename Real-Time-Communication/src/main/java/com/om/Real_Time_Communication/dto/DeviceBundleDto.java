package com.om.Real_Time_Communication.dto;

public class DeviceBundleDto {
    private String deviceId;
    private byte[] identityKeyPub;
    private byte[] signedPrekeyPub;
    private byte[] signedPrekeySig;
    private byte[] oneTimePrekeyPub; // nullable if none available

    public DeviceBundleDto() {}
    public DeviceBundleDto(String deviceId, byte[] ik, byte[] spk, byte[] sig, byte[] otk) {
        this.deviceId = deviceId; this.identityKeyPub = ik; this.signedPrekeyPub = spk; this.signedPrekeySig = sig; this.oneTimePrekeyPub = otk;
    }

    public String getDeviceId() { return deviceId; } public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public byte[] getIdentityKeyPub() { return identityKeyPub; } public void setIdentityKeyPub(byte[] identityKeyPub) { this.identityKeyPub = identityKeyPub; }
    public byte[] getSignedPrekeyPub() { return signedPrekeyPub; } public void setSignedPrekeyPub(byte[] signedPrekeyPub) { this.signedPrekeyPub = signedPrekeyPub; }
    public byte[] getSignedPrekeySig() { return signedPrekeySig; } public void setSignedPrekeySig(byte[] signedPrekeySig) { this.signedPrekeySig = signedPrekeySig; }
    public byte[] getOneTimePrekeyPub() { return oneTimePrekeyPub; } public void setOneTimePrekeyPub(byte[] oneTimePrekeyPub) { this.oneTimePrekeyPub = oneTimePrekeyPub; }
}
