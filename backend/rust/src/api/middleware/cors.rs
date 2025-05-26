use actix_cors::Cors;
use actix_web::http::header;

pub fn create_cors() -> Cors {
    let allowed_origins = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173".to_string());

    let origins: Vec<&str> = allowed_origins.split(',').collect();

    let mut cors = Cors::default()
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        .allowed_headers(vec![
            header::AUTHORIZATION,
            header::ACCEPT,
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-requested-with"),
            header::HeaderName::from_static("x-user-id"),
        ])
        .supports_credentials()
        .max_age(3600);

    // Add each allowed origin
    for origin in origins {
        cors = cors.allowed_origin(origin.trim());
    }

    cors
}

pub fn create_permissive_cors() -> Cors {
    Cors::permissive()
}
