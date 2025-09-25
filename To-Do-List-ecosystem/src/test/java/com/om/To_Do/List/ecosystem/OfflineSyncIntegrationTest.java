package com.om.To_Do.List.ecosystem;

import com.om.To_Do.List.ecosystem.dto.CreateChecklistRequest;
import com.om.To_Do.List.ecosystem.dto.ToDoListSummaryDTO;
import com.om.To_Do.List.ecosystem.dto.UpdateChecklistItemRequest;
import com.om.To_Do.List.ecosystem.model.ToDoItem;
import com.om.To_Do.List.ecosystem.model.ToDoList;
import com.om.To_Do.List.ecosystem.repository.ToDoItemRepository;
import com.om.To_Do.List.ecosystem.services.ToDoListService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class OfflineSyncIntegrationTest {

    @Autowired
    private ToDoListService toDoListService;


    @Autowired
    private ToDoItemRepository toDoItemRepository;

    @Test
    void offlineChangesAreSyncedAndServerUpdatesFetched() throws Exception {
        // Create initial checklist with a single item while online
        CreateChecklistRequest request = new CreateChecklistRequest();
        request.setCreatedByUserId(1L);
        request.setTitle("Groceries");
        request.setItems(List.of(new CreateChecklistRequest.ChecklistItemDTO("Milk")));

        ToDoList list = toDoListService.createChecklist(request);
        Long listId = list.getId();

        // Locate the single item that was created
        ToDoItem existing = toDoItemRepository.findAll().stream()
                .filter(it -> it.getList().getId().equals(listId))
                .findFirst()
                .orElseThrow();

        Long existingItemId = existing.getId();

        // Server-side change while the client is offline
        ToDoItem serverItem = new ToDoItem();
        serverItem.setItemName("Eggs");
        serverItem.setList(list);
        toDoItemRepository.save(serverItem);

        // Client modifies existing item while offline
        UpdateChecklistItemRequest offlineUpdate = new UpdateChecklistItemRequest("Milk - 2L");

        // Client comes back online and syncs the offline change
        toDoListService.updateChecklistItem(listId, existingItemId, 1L, offlineUpdate);

        // Client fetches the latest list to receive server-side updates
        ToDoListSummaryDTO summary = toDoListService.getListByIdAndCreator(listId,"919988776611");

        // Ensure offline change was applied
        assertTrue(summary.getItems().stream()
                .anyMatch(i -> i.getItemName().equals("Milk - 2L")), "Offline update not applied");

        // Ensure server-side update was received
        assertTrue(summary.getItems().stream()
                .anyMatch(i -> i.getItemName().equals("Eggs")), "Server update not received");

        // Ensure no duplicate items exist
        assertEquals(2, summary.getItems().size(), "Unexpected number of items after sync");
    }
}
