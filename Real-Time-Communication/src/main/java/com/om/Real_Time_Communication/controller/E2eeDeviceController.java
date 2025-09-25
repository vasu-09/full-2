package com.om.Real_Time_Communication.controller;


import com.om.Real_Time_Communication.dto.DeviceBundleDto;
import com.om.Real_Time_Communication.dto.RegisterDto;
import com.om.Real_Time_Communication.service.E2eeDeviceService;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/e2ee")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class E2eeDeviceController {

    private final E2eeDeviceService svc;

    public E2eeDeviceController(E2eeDeviceService svc) { this.svc = svc; }

    /** Register or refresh device bundle + (optional) batch of OTKs. */
    @PostMapping("/devices/register")
    public void register(Principal principal, @RequestBody RegisterDto dto) {
        Long userId = Long.valueOf(principal.getName()); // or @RequestHeader("X-User-Id")
        svc.register(userId, dto);
    }

    /** Upload more OTKs for an existing device. */
    @PostMapping("/devices/{deviceId}/prekeys")
    public void uploadPrekeys(Principal principal, @PathVariable String deviceId, @RequestBody List<byte[]> prekeys) {
        Long userId = Long.valueOf(principal.getName());
        svc.addPrekeys(userId, deviceId, prekeys);
    }

    /** Fetch a single device bundle for a target user (identity + signed prekey). */
    @GetMapping("/users/{targetUserId}/devices/{deviceId}")
    public DeviceBundleDto fetchDevice(@PathVariable Long targetUserId, @PathVariable String deviceId) {
        return svc.getBundle(targetUserId, deviceId);
    }

    /** Discover target user's devices (non-consuming). */
    @GetMapping("/users/{targetUserId}/devices")
    public List<DeviceBundleDto> listDevices(@PathVariable Long targetUserId) {
        return svc.listBundles(targetUserId);
    }

    /** Claim (consume) one OTK for a target device and return the bundle. */
    @PostMapping("/claim-prekey")
    public DeviceBundleDto claimPrekey(@RequestParam Long userId, @RequestParam String deviceId) {
        // NOTE: authorize caller appropriately (must be a valid authenticated user).
        return svc.claimOneTimePrekey(userId, deviceId);
    }

    /** Get remaining OTK stock for your own device (UX prompt to replenish). */
    @GetMapping("/devices/{deviceId}/stock")
    public long stock(Principal principal, @PathVariable String deviceId) {
        Long userId = Long.valueOf(principal.getName());
        return svc.availablePrekeys(userId, deviceId);
    }
}