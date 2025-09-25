package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;
import java.util.List;

@Data
public class ListRecipientsDTO {
    private Long listId;
    private String title;
    private List<Long> recipientUserIds;

    public ListRecipientsDTO() {
    }

    public ListRecipientsDTO(Long listId, String title, List<Long> recipientUserIds) {
        this.listId = listId;
        this.title = title;
        this.recipientUserIds = recipientUserIds;
    }

    public Long getListId() {
        return listId;
    }

    public void setListId(Long listId) {
        this.listId = listId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<Long> getRecipientUserIds() {
        return recipientUserIds;
    }

    public void setRecipientUserIds(List<Long> recipientUserIds) {
        this.recipientUserIds = recipientUserIds;
    }
}
