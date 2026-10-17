using AstroHealth.Infrastructure.Persistence;
using Npgsql;

namespace AstroHealth.Tests.Infrastructure;

public class PostgresConnectionTests
{
    private const string NeonUrl =
        "postgresql://vita_owner:p%40ss@ep-cool-sun-123456-pooler.ap-southeast-1.aws.neon.tech/vita?sslmode=require&channel_binding=require";

    [Fact]
    public void Neon_url_is_converted_to_npgsql_format()
    {
        var builder = new NpgsqlConnectionStringBuilder(PostgresConnection.Normalize(NeonUrl));

        Assert.Equal("ep-cool-sun-123456-pooler.ap-southeast-1.aws.neon.tech", builder.Host);
        Assert.Equal(5432, builder.Port);
        Assert.Equal("vita", builder.Database);
        Assert.Equal("vita_owner", builder.Username);
        Assert.Equal("p@ss", builder.Password);
        Assert.Equal(SslMode.Require, builder.SslMode);
        Assert.Equal(ChannelBinding.Require, builder.ChannelBinding);
    }

    [Fact]
    public void Migrations_use_the_direct_endpoint_instead_of_the_pooler()
    {
        var builder = new NpgsqlConnectionStringBuilder(PostgresConnection.ForMigrations(NeonUrl));

        Assert.Equal("ep-cool-sun-123456.ap-southeast-1.aws.neon.tech", builder.Host);
    }

    [Fact]
    public void Insecure_ssl_modes_are_upgraded_and_timeout_raised()
    {
        var builder = new NpgsqlConnectionStringBuilder(
            PostgresConnection.Normalize("Host=db.example.com;Database=vita;Username=u;Password=p;SSL Mode=Disable;Timeout=5"));

        Assert.Equal(SslMode.Require, builder.SslMode);
        Assert.Equal(30, builder.Timeout);
    }

    [Fact]
    public void Pool_is_kept_warm_with_keepalives()
    {
        var builder = new NpgsqlConnectionStringBuilder(PostgresConnection.Normalize(NeonUrl));

        Assert.Equal(2, builder.MinPoolSize);
        Assert.Equal(30, builder.KeepAlive);
        Assert.True(builder.ConnectionIdleLifetime >= 900);
    }
}
