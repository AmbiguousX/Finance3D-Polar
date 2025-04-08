"use client"
import { Computer, Network, Sparkles } from 'lucide-react'
import { FaBusinessTime } from 'react-icons/fa'
import { OrbitingCirclesComponent } from './orbiting-circles'
import { motion } from "motion/react"
import SurfaceChart from '../Finance/SurfaceChart'

const features = [
  {
    name: 'Smart Data:',
    description:
      'With our proprietary 3D chart algorithms, you can make informed decisions with confidence.',
    icon: Computer,
  },
  {
    name: 'Understand Trends with more Wisdom:',
    description: 'Viewing data in the third dimension allows you to see patterns and relationships that would be difficult to detect in two dimensions.',
    icon: FaBusinessTime,
  },
  {
    name: 'Pure Customization',
    description: 'Design your perfect financial dashboard with our widget creation process',
    icon: Network,
  },
]

export default function SideBySide() {
  return (
    <section className="py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-16 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="lg:pr-8 lg:pt-4"
          >
            <div className="lg:max-w-lg">
              {/* Pill badge */}
              <div className="mb-6 w-fit rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-4 py-1">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-200">
                  <Sparkles className="h-4 w-4" />
                  <span>Why Choose Finance 3D?</span>
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 dark:from-white dark:via-blue-300 dark:to-white pb-2">
                Become smarter faster
              </h2>
              <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
                A modern financial dashboard built to meet your data visualization needs.
              </p>
              <dl className="mt-10 max-w-xl space-y-8 text-base leading-7 text-gray-600 lg:max-w-none">
                {features.map((feature, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    key={feature.name}
                    className="relative pl-12 group hover:bg-gray-50 dark:hover:bg-gray-800/50 p-4 rounded-xl transition-colors"
                  >
                    <dt className="inline font-semibold text-gray-900 dark:text-white">
                      <feature.icon
                        className="absolute left-3 top-5 h-6 w-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
                        aria-hidden="true"
                      />
                      {feature.name}
                    </dt>{' '}
                    <dd className="inline text-gray-600 dark:text-gray-300">{feature.description}</dd>
                  </motion.div>
                ))}
              </dl>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative rounded-xl overflow-hidden">

              <SurfaceChart ticker="AAPL" year={2024} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
