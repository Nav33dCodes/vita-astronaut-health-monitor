using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AstroHealth.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSpaceHazards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "RadiationDoseMsv",
                table: "VitalReadings",
                type: "numeric(12,6)",
                precision: 12,
                scale: 6,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(9,4)",
                oldPrecision: 9,
                oldScale: 4);

            migrationBuilder.AddColumn<decimal>(
                name: "RadiationDoseRateMsvPerDay",
                table: "VitalReadings",
                type: "numeric(9,3)",
                precision: 9,
                scale: 3,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MissionDoseMsv",
                table: "Astronauts",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "HabitatReadings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CarbonDioxideMmHg = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    OxygenPct = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    CabinPressureKpa = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    CabinTemperatureC = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    HumidityPct = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    RadiationDoseRateMsvPerDay = table.Column<decimal>(type: "numeric(9,3)", precision: 9, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HabitatReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HabitatReadings_Missions_MissionId",
                        column: x => x.MissionId,
                        principalTable: "Missions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WellnessEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AstronautId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    SleepHours = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    SleepEfficiencyPct = table.Column<int>(type: "integer", nullable: false),
                    ActiveMinutes = table.Column<int>(type: "integer", nullable: false),
                    LightExposureHours = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    Mood = table.Column<int>(type: "integer", nullable: true),
                    Stress = table.Column<int>(type: "integer", nullable: true),
                    Workload = table.Column<int>(type: "integer", nullable: true),
                    CheckInNote = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CheckedInAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WellnessEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WellnessEntries_Astronauts_AstronautId",
                        column: x => x.AstronautId,
                        principalTable: "Astronauts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HabitatReadings_MissionId_RecordedAtUtc",
                table: "HabitatReadings",
                columns: new[] { "MissionId", "RecordedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WellnessEntries_AstronautId_Date",
                table: "WellnessEntries",
                columns: new[] { "AstronautId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HabitatReadings");

            migrationBuilder.DropTable(
                name: "WellnessEntries");

            migrationBuilder.DropColumn(
                name: "RadiationDoseRateMsvPerDay",
                table: "VitalReadings");

            migrationBuilder.DropColumn(
                name: "MissionDoseMsv",
                table: "Astronauts");

            migrationBuilder.AlterColumn<decimal>(
                name: "RadiationDoseMsv",
                table: "VitalReadings",
                type: "numeric(9,4)",
                precision: 9,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,6)",
                oldPrecision: 12,
                oldScale: 6);
        }
    }
}
