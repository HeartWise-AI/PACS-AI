/* eslint-disable react/prop-types */
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const ModelHistComponent = ({ age }) => {
  const d3Container = useRef(null);

  // Function to create and update the histogram
  const createHistogram = age => {
    const margin = { top: 30, right: 10, bottom: 30, left: 10 };
    const width = 460 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;
    const mean = 68;
    const stdDev = 13; // Adjust the standard deviation based on your requirements
    const n = 10000;
    const normalDistributionArray = generateNormalDistributionArray(n, mean, stdDev);

    // Clear the existing SVG contents
    d3.select(d3Container.current).selectAll('*').remove();

    // Append the svg object to the container
    const svg = d3
      .select(d3Container.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    function boxMullerRandom() {
      let u = 0,
        v = 0;
      while (u === 0) {
        u = Math.random();
      } // Converting [0,1) to (0,1)
      while (v === 0) {
        v = Math.random();
      }
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function generateNormalDistributionArray(n, mean, stdDev) {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const age_gen = mean + boxMullerRandom() * stdDev;
        arr.push({ age_gen: age_gen.toFixed(1) });
      }
      return arr;
    }

    // Add the x Axis
    const x = d3.scaleLinear().range([0, width]).domain([18, 115]);
    svg
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('fill', 'white');
    svg.selectAll('.tick line').style('stroke', 'white');
    svg.selectAll('.domain').style('stroke', 'white');

    // Add the y Axis
    const y = d3.scaleLinear().range([height, 0]).domain([0, 0.03]);
    svg.append('g').call(d3.axisLeft(y)).selectAll('text').style('fill-opacity', 0); // Make Y-axis text transparent
    svg.selectAll('.tick line').style('stroke-opacity', 0); // Make Y-axis tick lines transparent
    svg.selectAll('.domain').style('stroke-opacity', 0); // Make Y-axis line transparent

    // Compute kernel density estimation
    const kde = kernelDensityEstimator(kernelEpanechnikov(7), x.ticks(40));
    const density = kde(normalDistributionArray.map(d => d.age_gen));

    // Plot the area
    svg
      .append('path')
      .attr('class', 'mypath')
      .datum(density)
      .attr('fill', '#69b3a2')
      .attr('opacity', '.8')
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('stroke-linejoin', 'round')
      .attr(
        'd',
        d3
          .line()
          .curve(d3.curveBasis)
          .x(d => x(d[0]))
          .y(d => y(d[1]))
      );

    let lineCol = '#3E874A';
    if (age > 94 || age < 40) {
      lineCol = '#C29A5F';
    }

    svg
      .append('line')
      .attr('x1', x(age))
      .attr('x2', x(age))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', lineCol)
      .attr('stroke-width', 4)
      .attr('color', lineCol);

    svg
      .append('circle')
      .attr('cx', x(age))
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', lineCol)
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('id', 'ageCircle')
      .on('mouseover', function () {
        d3.select(this).transition().duration(150).attr('fill', lineCol).attr('r', 15);
        svg
          .append('text')
          .attr('class', 'circle-text')
          .attr('x', x(age))
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(age)
          .style('pointer-events', 'none');
      })
      .on('mouseout', function () {
        svg.select('.circle-text').remove();
        d3.select(this).transition().duration(150).attr('fill', lineCol).attr('r', 8);
      });

    function kernelDensityEstimator(kernel, X) {
      return function (V) {
        return X.map(function (x) {
          return [
            x,
            d3.mean(V, function (v) {
              return kernel(x - v);
            }),
          ];
        });
      };
    }

    function kernelEpanechnikov(k) {
      return function (v) {
        return Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
      };
    }
  };

  useEffect(() => {
    if (age) {
      createHistogram(age);
    }
  }, [age]);

  return (
    <div
      id="my_dataviz"
      ref={d3Container}
    ></div>
  );
};

export default ModelHistComponent;
