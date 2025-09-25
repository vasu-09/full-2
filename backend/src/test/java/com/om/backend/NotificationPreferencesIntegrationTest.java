package com.om.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationPreferencesIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    @Autowired
    UserRepository userRepo;

    private Long userId;
    private Instant before;

    @BeforeEach
    void setUp() {
        userRepo.deleteAll();
        User u = new User();
        u.setPhoneNumber("+10000000000");
        u.setActive(true);
        u = userRepo.save(u);
        userId = u.getId();
        before = u.getPrefsUpdatedAt();
    }

    @Test
    void roundTripNotificationPrefs() throws Exception {
        NotificationPreferences prefs = new NotificationPreferences();
        prefs.previewPolicy = "hide";
        prefs.messages.enabled = false;

        mvc.perform(put("/user/me/preferences/notifications")
                        .principal(() -> userId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(prefs)))
                .andExpect(status().isOk());

        String body = mvc.perform(get("/user/me/preferences/notifications")
                        .principal(() -> userId.toString()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        NotificationPreferences out = om.readValue(body, NotificationPreferences.class);
        assertThat(out.previewPolicy).isEqualTo("hide");
        assertThat(out.messages.enabled).isFalse();

        User updated = userRepo.findById(userId).orElseThrow();
        assertThat(updated.getNotificationPrefs().previewPolicy).isEqualTo("hide");
        assertThat(updated.getPrefsUpdatedAt()).isAfter(before);
    }
}