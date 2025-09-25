package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;
import java.util.List;

@Data
public class SyncRequest {
    private List<SyncItemDTO> items;

    public SyncRequest() {
    }

    public SyncRequest(List<SyncItemDTO> items) {
        this.items = items;
    }

    public List<SyncItemDTO> getItems() {
        return items;
    }

    public void setItems(List<SyncItemDTO> items) {
        this.items = items;
    }
}
