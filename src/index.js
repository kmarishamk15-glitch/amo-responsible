if (
  pipelineId === 5276629 &&
  newStatusId === 142
) {
  console.log("🧹 Clearing reject reason (status 142)");

  const clearRes = await fetch(
    `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.AMO_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        custom_fields_values: [
          {
            field_id: 573457,
            values: null
          }
        ]
      })
    }
  );

  console.log("🧹 Clear status:", clearRes.status);
  console.log("🧹 Clear response:", await clearRes.text());
}
