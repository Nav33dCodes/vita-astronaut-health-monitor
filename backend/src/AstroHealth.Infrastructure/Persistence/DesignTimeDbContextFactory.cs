using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AstroHealth.Infrastructure.Persistence;

/// <summary>
/// Used by <c>dotnet ef</c> to build the model for PostgreSQL migrations.
/// Generating a migration never connects; applying one reads VITA_MIGRATIONS_CONNECTION.
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("VITA_MIGRATIONS_CONNECTION")
                         ?? "Host=localhost;Database=vita;Username=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresConnection.ForMigrations(connection))
            .Options;

        return new AppDbContext(options);
    }
}
