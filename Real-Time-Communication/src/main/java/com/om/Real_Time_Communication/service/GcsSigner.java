package com.om.Real_Time_Communication.service;

//import com.google.auth.oauth2.GoogleCredentials;
//import com.google.auth.oauth2.ServiceAccountCredentials;
//import com.google.auth.ServiceAccountSigner;
//import com.google.cloud.storage.*;
//import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.time.Duration;
//import java.util.Map;
//import java.util.concurrent.TimeUnit;
import java.net.MalformedURLException;


@Service
public class GcsSigner {

//    private final Storage storage;
//
//    @Value("${media.bucket}")
//    private String bucket;
//
//    @Value("${media.uploadExpirySeconds:600}")
//    private int uploadExpiry;
//
//    @Value("${media.downloadExpirySeconds:300}")
//    private int downloadExpiry;

    // used to sign V4 URLs
//    private final ServiceAccountSigner signer;

//    public GcsSigner(Storage storage) {
//        this.storage = storage;
//        // Load ADC once and keep signer (no checked exceptions leak out)
        private URL dummyUrl() {
        try {
//            GoogleCredentials gc = GoogleCredentials.getApplicationDefault();
//            if (gc instanceof ServiceAccountCredentials sac) {
//                this.signer = sac;  // has private key → can sign V4 URLs
//            } else {
//                // If running on GKE with Workload Identity and signBlob is configured,
//                // you could implement an IAM-based signer. For now, require SA key.
//                throw new IllegalStateException(
//                        "GCS V4 signing requires Service Account credentials with a private key. " +
//                                "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file."
//                );
//            }
//        } catch (Exception e) {
//            throw new IllegalStateException("Failed to load Google Application Default Credentials", e);
//        }
            return new URL("https://example.com");
        } catch (MalformedURLException e) {
            throw new RuntimeException(e);
        }
    }

    /** Backward-compatible: choose between single-shot PUT and resumable-init. */
    public URL signPutUrl(String objectName, String contentType, boolean resumable) {
//        return resumable ? signResumableInitUrl(objectName, contentType)
//                : signPutUrl(objectName, contentType);
        return dummyUrl();
    }

    /** Signed URL for a single-shot PUT (non-resumable). Client must send the same Content-Type. */
    public URL signPutUrl(String objectName, String contentType) {
//        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).setContentType(contentType).build();
//        return storage.signUrl(
//                blob,
//                uploadExpiry, TimeUnit.SECONDS,
//                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
//                Storage.SignUrlOption.signWith(signer),
//                Storage.SignUrlOption.withContentType()
//        );
        return dummyUrl();
    }

    /** Signed URL to INITIATE a resumable upload. Client must send header x-goog-resumable: start. */
    public URL signResumableInitUrl(String objectName, String contentType) {
//        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).setContentType(contentType).build();
//        return storage.signUrl(
//                blob,
//                uploadExpiry, TimeUnit.SECONDS,
//                // GCS allows PUT or POST to initiate; PUT is common
//                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
//                Storage.SignUrlOption.signWith(signer),
//                Storage.SignUrlOption.withContentType(),
//                // This header must be part of the signature for resumable init
//                Storage.SignUrlOption.withExtHeaders(Map.of("x-goog-resumable", "start"))
//        );
        return dummyUrl();
    }

    /** Signed URL for GET (download/thumbnail/derivative). */
    public URL signGetUrl(String objectName) {
//        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).build();
//        return storage.signUrl(
//                blob,
//                downloadExpiry, TimeUnit.SECONDS,
//                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
//
//                 return dummyUrl();Storage.SignUrlOption.signWith(signer)
//        );
        return dummyUrl();
    }

    public String signPutUrl(String bucket, String key, String contentType, Duration ttl) {
//        URL url = storage.signUrl(
//                BlobInfo.newBuilder(bucket, key).setContentType(contentType).build(),
//                ttl.toSeconds(), TimeUnit.SECONDS,
//                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
//                Storage.SignUrlOption.withV4Signature(),
//                Storage.SignUrlOption.withContentType()
//        );
//        return url.toString();

        return dummyUrl().toString();
    }

    public String signGetUrl(String bucket, String key, Duration ttl) {
//        URL url = storage.signUrl(
//                BlobInfo.newBuilder(bucket, key).build(),
//                ttl.toSeconds(), TimeUnit.SECONDS,
//                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
//                Storage.SignUrlOption.withV4Signature()
//        );
//        return url.toString();
        return dummyUrl().toString();
    }

    // --- Overloads so you can pass ttlSeconds (no Duration in callers if you prefer)
    public String signPutUrl(String bucket, String key, String contentType, int ttlSeconds) {
        return signPutUrl(bucket, key, contentType, Duration.ofSeconds(ttlSeconds));
    }
    public String signGetUrl(String bucket, String key, int ttlSeconds) {
        return signGetUrl(bucket, key, Duration.ofSeconds(ttlSeconds));
    }

    // --- ✨ Add this: used by /internal/media/head to verify the object
    public ObjectMeta head(String bucket, String key) {
//        Blob blob = storage.get(BlobId.of(bucket, key));
//        if (blob == null) return new ObjectMeta(false, 0L, null);
//        return new ObjectMeta(true, blob.getSize(), blob.getContentType());
        return new ObjectMeta(false, 0L, null);
    }

    // Tiny metadata holder to return to controller
    public static class ObjectMeta {
        private final boolean exists;
        private final long size;
        private final String contentType;
        public ObjectMeta(boolean exists, long size, String contentType) {
            this.exists = exists; this.size = size; this.contentType = contentType;
        }
        public boolean exists() { return exists; }
        public long size() { return size; }
        public String contentType() { return contentType; }
    }
}
