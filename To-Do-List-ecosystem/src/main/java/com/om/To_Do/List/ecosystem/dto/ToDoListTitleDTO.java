package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;

@Data
public class ToDoListTitleDTO {
    private Long id;
    private String title;

    public ToDoListTitleDTO() {

    }

    public ToDoListTitleDTO(Long id, String title) {
        this.id = id;
        this.title = title;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}

