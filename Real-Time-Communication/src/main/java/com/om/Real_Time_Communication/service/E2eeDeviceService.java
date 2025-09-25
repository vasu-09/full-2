package com.om.Real_Time_Communication.service;


import com.om.Real_Time_Communication.Repository.E2eeDeviceRepository;
import com.om.Real_Time_Communication.Repository.E2eeOneTimePrekeyRepository;
import com.om.Real_Time_Communication.dto.DeviceBundleDto;
import com.om.Real_Time_Communication.dto.RegisterDto;
import com.om.Real_Time_Communication.models.E2eeDevice;
import com.om.Real_Time_Communication.models.E2eeOneTimePrekey;
import com.om.Real_Time_Communication.security.Ed25519Verifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class E2eeDeviceService {

    private final E2eeDeviceRepository deviceRepo;
    private final E2eeOneTimePrekeyRepository prekeyRepo;

    public E2eeDeviceService(E2eeDeviceRepository deviceRepo, E2eeOneTimePrekeyRepository prekeyRepo) {
        this.deviceRepo = deviceRepo; this.prekeyRepo = prekeyRepo;
    }

    /** Register/refresh a device bundle and upload optional batch of OTKs. */
    @Transactional
    public void register(Long userId, RegisterDto dto) {
        require(dto.getDeviceId() != null && !dto.getDeviceId().isBlank(), "deviceId required");
        require(dto.getIdentityKeyPub()!=null && dto.getIdentityKeyPub().length==32, "identityKeyPub invalid");
        require(dto.getSignedPrekeyPub()!=null && dto.getSignedPrekeyPub().length==32, "signedPrekeyPub invalid");
        require(dto.getSignedPrekeySig()!=null && dto.getSignedPrekeySig().length==64, "signedPrekeySig invalid");

        // Verify signedPrekeySig = Ed25519_sign(identityKeyPriv, signedPrekeyPub)
        boolean ok = Ed25519Verifier.verify(dto.getIdentityKeyPub(), dto.getSignedPrekeyPub(), dto.getSignedPrekeySig());
        require(ok, "signedPrekeySig verification failed");

        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(userId, dto.getDeviceId()).orElseGet(E2eeDevice::new);
        dev.setUserId(userId);
        dev.setDeviceId(dto.getDeviceId());
        dev.setName(dto.getName());
        dev.setPlatform(dto.getPlatform());
        dev.setIdentityKeyPub(dto.getIdentityKeyPub());
        dev.setSignedPrekeyPub(dto.getSignedPrekeyPub());
        dev.setSignedPrekeySig(dto.getSignedPrekeySig());
        dev.setLastSeen(Instant.now());
        deviceRepo.save(dev);

        if (dto.getOneTimePrekeys()!=null) {
            for (byte[] otk : dto.getOneTimePrekeys()) {
                if (otk == null || otk.length == 0) continue;
                E2eeOneTimePrekey p = new E2eeOneTimePrekey();
                p.setUserId(userId); p.setDeviceId(dto.getDeviceId()); p.setPrekeyPub(otk);
                prekeyRepo.save(p);
            }
        }
    }

    /** Claim one OTK for a target device (consumes it); returns bundle+OTK (or null otk). */
    @Transactional
    public DeviceBundleDto claimOneTimePrekey(Long targetUserId, String deviceId) {
        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(targetUserId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        byte[] otk = null;
        var avail = prekeyRepo.findAvailable(targetUserId, deviceId);
        if (!avail.isEmpty()) {
            var first = avail.get(0);
            otk = first.getPrekeyPub();
            first.setConsumed(true);
            prekeyRepo.save(first);
        }
        return new DeviceBundleDto(dev.getDeviceId(), dev.getIdentityKeyPub(), dev.getSignedPrekeyPub(), dev.getSignedPrekeySig(), otk);
    }

    /** Fetch a single device bundle without consuming any one-time prekeys. */
    @Transactional(readOnly = true)
    public DeviceBundleDto getBundle(Long targetUserId, String deviceId) {
        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(targetUserId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        return new DeviceBundleDto(dev.getDeviceId(), dev.getIdentityKeyPub(), dev.getSignedPrekeyPub(), dev.getSignedPrekeySig(), null);
    }

    /** List device bundles (without consuming OTKs). */
    @Transactional(readOnly = true)
    public List<DeviceBundleDto> listBundles(Long targetUserId) {
        var devs = deviceRepo.findByUserId(targetUserId);
        var out = new ArrayList<DeviceBundleDto>(devs.size());
        for (var d : devs) {
            out.add(new DeviceBundleDto(d.getDeviceId(), d.getIdentityKeyPub(), d.getSignedPrekeyPub(), d.getSignedPrekeySig(), null));
        }
        return out;
    }

    /** Upload additional OTKs for an existing device. */
    @Transactional
    public void addPrekeys(Long userId, String deviceId, List<byte[]> prekeys) {
        deviceRepo.findByUserIdAndDeviceId(userId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        if (prekeys == null) return;
        for (byte[] otk : prekeys) {
            if (otk == null || otk.length == 0) continue;
            E2eeOneTimePrekey p = new E2eeOneTimePrekey();
            p.setUserId(userId); p.setDeviceId(deviceId); p.setPrekeyPub(otk);
            prekeyRepo.save(p);
        }
    }

    @Transactional(readOnly = true)
    public long availablePrekeys(Long userId, String deviceId) {
        return prekeyRepo.countByUserIdAndDeviceIdAndConsumedFalse(userId, deviceId);
    }

    private static void require(boolean cond, String msg) {
        if (!cond) throw new IllegalArgumentException(msg);
    }
}