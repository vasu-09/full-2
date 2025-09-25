package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateChecklistRequest {
    private Long createdByUserId;
    private String title;
    private List<ChecklistItemDTO> items;

    public CreateChecklistRequest() {
    }

    public CreateChecklistRequest(Long createdByUserId, String title, List<ChecklistItemDTO> items) {
        this.createdByUserId = createdByUserId;
        this.title = title;
        this.items = items;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<ChecklistItemDTO> getItems() {
        return items;
    }

    public void setItems(List<ChecklistItemDTO> items) {
        this.items = items;
    }

    @Data
    public static class ChecklistItemDTO {
        private String itemName;

        public ChecklistItemDTO() {
        }

        public ChecklistItemDTO(String itemName) {
            this.itemName = itemName;
        }

        public String getItemName() {
            return itemName;
        }

        public void setItemName(String itemName) {
            this.itemName = itemName;
        }
    }
}