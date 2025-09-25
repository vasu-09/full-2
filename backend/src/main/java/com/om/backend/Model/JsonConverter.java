package com.om.backend.Model;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;

public abstract class JsonConverter<T> implements AttributeConverter<T, String> {
    private static final ObjectMapper M = new ObjectMapper();
    private final Class<T> type;
    protected JsonConverter(Class<T> type) { this.type = type; }

    @Override public String convertToDatabaseColumn(T attribute) {
        try { return attribute == null ? "{}" : M.writeValueAsString(attribute); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Override public T convertToEntityAttribute(String dbData) {
        try {
            return (dbData == null || dbData.isBlank())
                    ? type.getDeclaredConstructor().newInstance()
                    : M.readValue(dbData, type);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}