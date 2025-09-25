package com.om.backend.services;

import com.om.backend.Dto.ContactMatchDto;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ContactSyncService {
    @Autowired
    private  UserRepository userRepo;

    public List<ContactMatchDto> match(List<String> e164Phones) {
        if (e164Phones == null || e164Phones.isEmpty()) return List.of();
        // batch find: create an index on phone_number
        List<User> users = userRepo.findByPhoneNumberIn(e164Phones);
        return users.stream()
                .map(u -> new ContactMatchDto(u.getId(), u.getPhoneNumber()))
                .toList();
    }
}
