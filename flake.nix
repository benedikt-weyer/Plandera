{
  description = "Development shell for Plandera";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs;
              [
                # Node.js and related tools for Next.js frontend
                nodejs_20
                pnpm
                typescript
                typescript-language-server

                # Rust toolchain for backend
                rustc
                cargo
                cargo-watch
                rustfmt
                clippy
                rust-analyzer

                # Database tools
                postgresql_15

                # Container tools
                docker
                docker-compose

                # System dependencies for Rust compilation
                pkg-config
                openssl
                openssl.dev

                # Additional build tools
                gcc

                # Useful development tools
                curl
                jq
                git
                wget
              ]
              ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.libiconv ];

            RUST_LOG = "debug";
            DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
            JWT_SECRET = "dev-jwt-secret-key-for-local-development-only";
            VITE_BACKEND_URL = "http://localhost:3001";
            PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.postgresql_15}/lib/pkgconfig";
            OPENSSL_DIR = "${pkgs.openssl.dev}";
            OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
            OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

            shellHook = ''
              unset NODE_ENV
            '';
          };
        });
    };
}