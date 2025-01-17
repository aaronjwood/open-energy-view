import React from "react";
import {
  Dropdown,
  DropdownButton,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { Pie } from "react-chartjs-2";
import { sum, max } from "ramda";
import { readableWattHours } from "../../functions/readableWattHours";
import { useState } from "react";
import { lookupPartitionSums } from "../../functions/lookupPartitionSums";
import { differenceInMilliseconds, roundToNearestMinutes } from "date-fns";
import { editHsl } from "../../functions/editHsl";
import { useEffect } from "react";
import { customTooltips } from "../../data-structures/helpers/customTooltips";

/**
 * Return a flexibly sized ChartJS pie chart.
 */
const MiniPie = ({
  energyHistory,
  showOptions = true,
  startingView = "activity",
  setMostIntensePart = () => null,
  setMostUsedPart = () => null,
}) => {
  const [currentView, setCurrentView] = useState(startingView);
  const partitionSums = lookupPartitionSums(
    energyHistory.partitionSums,
    energyHistory.startDateIndex,
    energyHistory.endDateIndex
  );

  const windowHours = Math.round(
    Math.abs(
      differenceInMilliseconds(
        roundToNearestMinutes(energyHistory.startDate),
        roundToNearestMinutes(energyHistory.endDate)
      )
    ) / 3600000
  );

  const labels = energyHistory.partitionOptions.value
    .map((x) => x.name)
    .concat(["Passive", "Appliance"]);
  const colors = energyHistory.partitionOptions.value
    .map((x) => x.color)
    .concat([
      editHsl("hsl(275, 9%, 37%)", { s: (s) => 0, l: (l) => 85 }),
      editHsl("hsl(275, 9%, 37%)", {
        s: (s) => Math.min(100, s * 2),
        l: (l) => (l + 200) / 3,
      }),
    ]);

  // these sums may be made availabe in the DP implementation of passive calc
  const makePieData = (currentView) => {
    switch (currentView) {
      case "total":
        return partitionSums.map((x) => x.sumTotal);
      case "activity":
        const active = partitionSums.map((x) => x.sumActive);
        const passive = partitionSums.reduce((acc, x) => acc + x.sumPassive, 0);
        const spike = partitionSums.reduce((acc, x) => acc + x.sumSpike, 0);
        return active.concat(passive).concat(spike);
      case "average":
        const active2 = partitionSums.map((x) => x.sumTotal);
        const partLengthArray = energyHistory.partitionOptions.value.map(
          (x, i) => {
            const parts = energyHistory.partitionOptions.value.length;
            const distance =
              energyHistory.partitionOptions.value[(i + 1) % parts].start -
              x.start;
            return distance >= 0 ? distance : 24 + distance;
          }
        );
        const totalHoursPerPart = partLengthArray.map(
          (x) => (x * windowHours) / 24
        );
        return active2.map((x, i) => x / totalHoursPerPart[i]);

      default:
        return;
    }
  };

  const mostIntense = makePieData("average").reduce(
    (acc, x, i) => {
      if (x > acc.value) return { value: x, index: i };
      return acc;
    },
    { value: -Infinity }
  );

  const mostUsed = makePieData("activity").reduce(
    (acc, x, i) => {
      if (x > acc.value) return { value: x, index: i };
      return acc;
    },
    { value: -Infinity }
  );

  useEffect(() => {
    setMostUsedPart(labels[mostUsed.index]);
    setMostIntensePart(labels[mostIntense.index]);
  }, []);

  const pieData = makePieData(currentView);

  const data = {
    datasets: [
      {
        data: pieData,
        backgroundColor: colors,
      },
    ],
    labels: labels,
  };

  const options = {
    animation: {
      duration: 0,
    },
    maintainAspectRatio: true,
    aspectRatio: 1,
    legend: {
      display: false,
    },
    tooltips: {
      enabled: false,
      custom: customTooltips,
      callbacks: {
        title: (tooltipItem) => {
          return data.labels[tooltipItem[0].index];
        },
        label: (tooltipItem) => {
          return (
            Math.round(
              (data.datasets[0].data[tooltipItem.index] /
                sum(data.datasets[0].data)) *
                100
            ) +
            "%" +
            "\n" +
            readableWattHours(data.datasets[0].data[tooltipItem.index])
          );
        },
      },
    },
  };

  const makeTitle = (value) => {
    switch (value) {
      case "total":
        return "Total";
      case "activity":
        return "Activity";
      case "average":
        return "Intensity";
    }
  };

  const makeTooltip = (value) => {
    switch (value) {
      case "total":
        return "Shows how much energy was used during each daily period";
      case "activity":
        return "Shows how much energy each activity used";
      case "average":
        return "Shows how intensely energy is used during each daily period";
    }
  };

  /**
   * Return the dropdown items with tooltip overlays.
   *
   * @param {String} value The title and tooltip to create: "total", "activity", "average"
   */
  const makeMenuItem = (value) => (
    <OverlayTrigger
      placement="left"
      overlay={<Tooltip>{makeTooltip(value)}</Tooltip>}
    >
      <Dropdown.Item eventKey={value}>{makeTitle(value)}</Dropdown.Item>
    </OverlayTrigger>
  );

  const handleClick = (e) => {
    setCurrentView(e);
  };

  const pieOptions = showOptions ? (
    <DropdownButton
      className="pie-dropdown"
      size="sm"
      title={makeTitle(currentView)}
      onSelect={(e) => e != currentView && handleClick(e)}
    >
      {makeMenuItem("total")}
      {makeMenuItem("activity")}
      {makeMenuItem("average")}
    </DropdownButton>
  ) : null;

  return (
    <div className="mini-pie">
      <Pie data={data} options={options} />
      {pieOptions}
    </div>
  );
};

export default MiniPie;
