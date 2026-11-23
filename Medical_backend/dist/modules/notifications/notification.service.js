"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = notify;
exports.notifyAsync = notifyAsync;
exports.notifyAdmins = notifyAdmins;
const prisma_1 = require("../../database/prisma");
const logger_1 = require("../../lib/logger");
const mailer_1 = require("../../lib/mailer");
const sms_1 = require("../../lib/sms");
/**
 * Central notification dispatcher. Always records an in-app notification and
 * fans out to the requested channels. Delivery failures are recorded on the
 * row and never propagate to the calling business flow.
 */
async function notify(input) {
    const channels = input.channels?.length ? input.channels : ['IN_APP'];
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, phone: true, firstName: true },
    });
    if (!user) {
        logger_1.logger.warn({ userId: input.userId, event: input.event }, 'Notification skipped — user not found');
        return;
    }
    for (const channel of channels) {
        const record = await prisma_1.prisma.notification.create({
            data: {
                userId: user.id,
                channel,
                event: input.event,
                title: input.title,
                body: input.body,
                data: input.data,
                status: channel === 'IN_APP' ? 'SENT' : 'QUEUED',
                sentAt: channel === 'IN_APP' ? new Date() : null,
            },
        });
        if (channel === 'IN_APP')
            continue;
        try {
            if (channel === 'EMAIL' && user.email) {
                await (0, mailer_1.sendMail)({
                    to: user.email,
                    subject: input.title,
                    html: (0, mailer_1.renderTemplate)(input.title, `<p>Hi ${user.firstName},</p><p>${input.body}</p>`),
                    text: input.body,
                });
            }
            else if (channel === 'SMS' && user.phone) {
                await (0, sms_1.sendSms)(user.phone, `${input.title}: ${input.body}`);
            }
            else if (channel === 'PUSH') {
                logger_1.logger.debug({ userId: user.id }, 'Push channel not configured — stored as in-app only');
            }
            await prisma_1.prisma.notification.update({
                where: { id: record.id },
                data: { status: 'SENT', sentAt: new Date() },
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error, channel, event: input.event }, 'Notification delivery failed');
            await prisma_1.prisma.notification.update({
                where: { id: record.id },
                data: { status: 'FAILED', error: error.message.slice(0, 500) },
            });
        }
    }
}
/** Fire-and-forget variant for use inside request handlers. */
function notifyAsync(input) {
    void notify(input).catch((error) => logger_1.logger.error({ err: error, event: input.event }, 'notifyAsync failed'));
}
/** Notifies every super admin — used for approvals and platform-level alerts. */
async function notifyAdmins(input) {
    const admins = await prisma_1.prisma.user.findMany({
        where: { userType: 'SUPER_ADMIN', status: 'ACTIVE' },
        select: { id: true },
    });
    await Promise.all(admins.map((admin) => notify({ ...input, userId: admin.id })));
}
//# sourceMappingURL=notification.service.js.map