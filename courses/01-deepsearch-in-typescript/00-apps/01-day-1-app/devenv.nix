{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

# This uses https://devenv.sh to configure your working environmnt.
# To use:
# 1. Install nix: https://nixos.org/download.html 
# 2  Install `devenv` in your configuration
# 3. Expose `POSTGRES_PW` and `REDIS_PW` in .env
# 4. Run `devenv up` to start the environment (^c to stop)
# 5. Or run `devenv up -d` to start the environment in the background (and `devenv process stop` to kill the background process)
# 6. Run `devenv test` to confirm everything is working
{
  # Import environment variables from .env
  dotenv.enable = true;

  # https://devenv.sh/packages/
  # packages = [
  # ];

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      enable = true;
      pnpm = {
        enable = true;
        install.enable = true;
      };
    };
    typescript.enable = true;
    nix.enable = true;
  };

  # https://devenv.sh/processes/
  processes.drizzle.exec = "drizzle-kit studio";

  # https://devenv.sh/services/
  services = {
    postgres = {
      enable = true;
      port = 5432;
      listen_addresses = "localhost";
      initialDatabases = [
        {
          name = "ai-app-template";
          user = "postgres";
          pass = "${config.env.POSTGRES_PW}";
        }
      ];
      initialScript = "CREATE ROLE postgres SUPERUSER;"; 
      extensions = extensions: [ extensions.pgvector ];
    };
    redis = {
      enable = true;
      extraConfig = "requirepass ${config.env.REDIS_PW}";
    };
  };

  # https://devenv.sh/scripts/
  # scripts.hello.exec = ''
  #   echo hello
  # '';

  # enterShell = ''
  # '';

  # https://devenv.sh/tasks/
  # tasks = {
  #   "myproj:setup".exec = "mytool build";
  #   "devenv:enterShell".after = [ "myproj:setup" ];
  # };

  # https://devenv.sh/tests/
  enterTest = ''
    pg_isready -h localhost -p 5432
    node --env-file=.env test-redis.js
  '';

  # https://devenv.sh/git-hooks/
  # git-hooks.hooks.shellcheck.enable = true;

  # See full reference at https://devenv.sh/reference/options/
}
