using Npgsql;

namespace AstroHealth.Infrastructure.Persistence;

/// <summary>
/// Normalises PostgreSQL connection strings (including Neon's <c>postgresql://</c> URLs)
/// into Npgsql key/value form with production-safe defaults.
/// </summary>
public static class PostgresConnection
{
    // Neon marks its PgBouncer endpoint with this suffix on the endpoint id.
    private const string NeonPoolerSuffix = "-pooler";

    public static string Normalize(string connectionString)
    {
        var builder = connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
                      connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            ? FromUrl(connectionString)
            : new NpgsqlConnectionStringBuilder(connectionString);

        // Managed Postgres (Neon) requires TLS; never allow a silent downgrade.
        if (builder.SslMode is SslMode.Disable or SslMode.Allow or SslMode.Prefer)
        {
            builder.SslMode = SslMode.Require;
        }

        // Opening a connection costs ~5 network round-trips (TCP, TLS, SCRAM auth). Serverless
        // wake-ups and jittery client networks can stretch that, so allow generous headroom.
        if (builder.Timeout < 30)
        {
            builder.Timeout = 30;
        }

        // Keep a few physical connections warm so requests rarely pay the open cost,
        // and send TCP keepalives so idle connections aren't silently dropped by NAT/routers.
        if (builder.MinPoolSize == 0)
        {
            builder.MinPoolSize = 2;
        }

        if (builder.KeepAlive == 0)
        {
            builder.KeepAlive = 30;
        }

        builder.ConnectionIdleLifetime = Math.Max(builder.ConnectionIdleLifetime, 900);

        builder.ApplicationName ??= "vita-api";
        return builder.ConnectionString;
    }

    /// <summary>
    /// Migrations take a session-level advisory lock, which PgBouncer (transaction pooling) can't
    /// hold reliably — so they must use Neon's direct endpoint rather than the pooled one.
    /// </summary>
    public static string ForMigrations(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(Normalize(connectionString));
        if (builder.Host is { } host && host.Contains(NeonPoolerSuffix, StringComparison.OrdinalIgnoreCase))
        {
            builder.Host = host.Replace(NeonPoolerSuffix, string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        return builder.ConnectionString;
    }

    private static NpgsqlConnectionStringBuilder FromUrl(string url)
    {
        var uri = new Uri(url);
        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : null
        };

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0]).ToLowerInvariant();
            var value = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : string.Empty;

            switch (key)
            {
                case "sslmode":
                    builder.SslMode = Enum.Parse<SslMode>(value.Replace("-", string.Empty), ignoreCase: true);
                    break;
                case "channel_binding":
                    builder.ChannelBinding = Enum.Parse<ChannelBinding>(value, ignoreCase: true);
                    break;
                case "options":
                    builder.Options = value;
                    break;
                // Other libpq URL parameters have no Npgsql equivalent and are ignored.
            }
        }

        return builder;
    }
}
